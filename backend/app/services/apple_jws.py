from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.x509.oid import ExtensionOID

from app.core.apple_trust import apple_root_certificates
from app.core.errors import AppError

SUPPORTED_ALGS = frozenset({"ES256"})


class AppleJwsError(AppError):
    def __init__(self, message: str, code: str = "APPLE_JWS_INVALID") -> None:
        super().__init__(code, message, 400)


@dataclass(frozen=True)
class AppleNotification:
    notification_uuid: str
    notification_type: str
    subtype: str | None
    environment: str
    bundle_id: str
    product_id: str
    transaction_id: str
    original_transaction_id: str
    expires_at: datetime | None
    revoked: bool
    observed_at: datetime | None
    signed_date: datetime | None
    transaction: dict[str, Any]
    renewal: dict[str, Any]


class AppleJwsVerifier:
    def __init__(self, trusted_roots: tuple[x509.Certificate, ...] | None = None) -> None:
        self._roots = trusted_roots if trusted_roots is not None else apple_root_certificates()

    def verify_compact(self, token: str) -> dict[str, Any]:
        if not isinstance(token, str) or token.count(".") != 2:
            raise AppleJwsError("signedPayload is not a compact JWS.")
        header_b64, payload_b64, signature_b64 = token.split(".")
        try:
            header = json.loads(_b64url_decode(header_b64))
        except (ValueError, json.JSONDecodeError) as exc:
            raise AppleJwsError("JWS header is malformed.") from exc
        alg = header.get("alg")
        if alg not in SUPPORTED_ALGS:
            raise AppleJwsError("JWS algorithm is not supported.")
        x5c = header.get("x5c")
        if not isinstance(x5c, list) or not x5c:
            raise AppleJwsError("JWS x5c certificate chain is missing.")
        try:
            chain = [x509.load_der_x509_certificate(base64.b64decode(item)) for item in x5c]
        except ValueError as exc:
            raise AppleJwsError("JWS x5c certificates are malformed.") from exc
        _validate_chain(chain, self._roots)
        leaf = chain[0]
        public_key = leaf.public_key()
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise AppleJwsError("JWS leaf key is not an EC signing key.")
        try:
            public_key.verify(
                _jose_es256_to_der(_b64url_bytes(signature_b64)),
                f"{header_b64}.{payload_b64}".encode(),
                ec.ECDSA(hashes.SHA256()),
            )
        except InvalidSignature as exc:
            raise AppleJwsError("JWS signature is invalid.") from exc
        try:
            payload = json.loads(_b64url_decode(payload_b64))
        except (ValueError, json.JSONDecodeError) as exc:
            raise AppleJwsError("JWS payload is malformed.") from exc
        if not isinstance(payload, dict):
            raise AppleJwsError("JWS payload must be an object.")
        return payload

    def verify_notification(
        self,
        signed_payload: str,
        *,
        expected_bundle_id: str,
        expected_environment: str,
    ) -> AppleNotification:
        outer = self.verify_compact(signed_payload)
        data = outer.get("data") or {}
        environment = str(data.get("environment") or outer.get("environment") or "")
        if environment != expected_environment:
            raise AppleJwsError("Notification environment does not match configuration.")
        bundle = str(data.get("bundleId") or "")
        if bundle != expected_bundle_id:
            raise AppleJwsError("Notification bundle does not match this application.")
        signed_txn = data.get("signedTransactionInfo")
        signed_renewal = data.get("signedRenewalInfo")
        transaction: dict[str, Any] = {}
        renewal: dict[str, Any] = {}
        if signed_txn:
            transaction = self.verify_compact(str(signed_txn))
            if str(transaction.get("bundleId") or "") != expected_bundle_id:
                raise AppleJwsError("Transaction bundle does not match this application.")
            txn_env = str(transaction.get("environment") or environment)
            if txn_env != expected_environment:
                raise AppleJwsError("Transaction environment does not match configuration.")
        if signed_renewal:
            renewal = self.verify_compact(str(signed_renewal))
            renewal_env = str(renewal.get("environment") or environment)
            if renewal_env != expected_environment:
                raise AppleJwsError("Renewal environment does not match configuration.")
        expires = _ms(transaction.get("expiresDate"))
        revoked = transaction.get("revocationDate") is not None
        product_id = str(
            transaction.get("productId")
            or renewal.get("autoRenewProductId")
            or data.get("productId")
            or ""
        )
        transaction_id = str(transaction.get("transactionId") or "")
        original = str(
            transaction.get("originalTransactionId")
            or renewal.get("originalTransactionId")
            or transaction_id
        )
        observed = _ms(outer.get("signedDate")) or _ms(transaction.get("signedDate"))
        return AppleNotification(
            notification_uuid=str(outer.get("notificationUUID") or ""),
            notification_type=str(outer.get("notificationType") or "UNKNOWN"),
            subtype=str(outer.get("subtype")) if outer.get("subtype") else None,
            environment=environment,
            bundle_id=bundle,
            product_id=product_id,
            transaction_id=transaction_id or original,
            original_transaction_id=original,
            expires_at=expires,
            revoked=revoked,
            observed_at=observed,
            signed_date=observed,
            transaction=transaction,
            renewal=renewal,
        )


def expected_apple_environment(app_env: str, configured: str) -> str:
    value = (configured or "auto").strip()
    if value in {"Sandbox", "Production"}:
        return value
    if app_env == "production":
        return "Production"
    return "Sandbox"


def _validate_chain(
    chain: list[x509.Certificate],
    trusted_roots: tuple[x509.Certificate, ...],
) -> None:
    now = datetime.now(UTC)
    for cert in chain:
        if cert.not_valid_before_utc > now or cert.not_valid_after_utc < now:
            raise AppleJwsError("Certificate in the x5c chain is expired or not yet valid.")
    leaf = chain[0]
    _require_leaf_usage(leaf)
    for issuer in chain[1:]:
        _require_ca(issuer)
    for index in range(len(chain) - 1):
        _verify_issued_by(chain[index], chain[index + 1])
    last = chain[-1]
    for root in trusted_roots:
        if root.not_valid_before_utc > now or root.not_valid_after_utc < now:
            continue
        if _same_cert(last, root):
            if len(chain) < 2:
                raise AppleJwsError("x5c chain is missing the Apple intermediate.")
            return
        try:
            _require_ca(root)
            _verify_issued_by(last, root)
            return
        except AppleJwsError:
            continue
    raise AppleJwsError("x5c chain is not anchored to a trusted Apple root.")


def _require_leaf_usage(cert: x509.Certificate) -> None:
    try:
        usage = cert.extensions.get_extension_for_oid(ExtensionOID.KEY_USAGE).value
        if not usage.digital_signature:
            raise AppleJwsError("Leaf certificate is not a signing certificate.")
    except x509.ExtensionNotFound:
        pass
    try:
        basic = cert.extensions.get_extension_for_oid(ExtensionOID.BASIC_CONSTRAINTS).value
        if basic.ca:
            raise AppleJwsError("Leaf certificate must not be a CA.")
    except x509.ExtensionNotFound:
        pass


def _require_ca(cert: x509.Certificate) -> None:
    try:
        basic = cert.extensions.get_extension_for_oid(ExtensionOID.BASIC_CONSTRAINTS).value
    except x509.ExtensionNotFound as exc:
        raise AppleJwsError("CA certificate is missing basic constraints.") from exc
    if not basic.ca:
        raise AppleJwsError("Intermediate or root is not a CA certificate.")


def _verify_issued_by(child: x509.Certificate, issuer: x509.Certificate) -> None:
    if child.issuer != issuer.subject:
        raise AppleJwsError("Certificate chain subjects do not chain.")
    key = issuer.public_key()
    try:
        if isinstance(key, ec.EllipticCurvePublicKey):
            algorithm = child.signature_hash_algorithm
            key.verify(child.signature, child.tbs_certificate_bytes, ec.ECDSA(algorithm))
        else:
            raise AppleJwsError("Unsupported certificate public key.")
    except InvalidSignature as exc:
        raise AppleJwsError("Certificate chain signature is invalid.") from exc


def _same_cert(left: x509.Certificate, right: x509.Certificate) -> bool:
    return left.tbs_certificate_bytes == right.tbs_certificate_bytes


def _b64url_decode(value: str) -> str:
    return _b64url_bytes(value).decode("utf-8")


def _b64url_bytes(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _jose_es256_to_der(signature: bytes) -> bytes:
    if len(signature) != 64:
        raise AppleJwsError("JWS signature length is invalid for ES256.")
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    return encode_dss_signature(r, s)


def _ms(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=UTC)
    except (TypeError, ValueError, OSError):
        return None
