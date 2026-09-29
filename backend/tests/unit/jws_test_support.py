from __future__ import annotations

import base64
import json
from datetime import UTC, datetime, timedelta

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.serialization import Encoding
from cryptography.x509.oid import NameOID


def make_cert(
    common_name: str,
    *,
    issuer: x509.Certificate | None = None,
    issuer_key=None,
    ca: bool = False,
    days: int = 365,
    not_before_days: int = -1,
):
    key = ec.generate_private_key(ec.SECP256R1())
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    issuer_name = issuer.subject if issuer is not None else subject
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer_name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(UTC) + timedelta(days=not_before_days))
        .not_valid_after(datetime.now(UTC) + timedelta(days=days))
        .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=not ca,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=ca,
                crl_sign=ca,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
    )
    cert = builder.sign(issuer_key or key, hashes.SHA256())
    return cert, key


def apple_test_chain():
    root, root_key = make_cert("Test Apple Root", ca=True)
    intermediate, intermediate_key = make_cert(
        "Test WWDR Intermediate", issuer=root, issuer_key=root_key, ca=True
    )
    leaf, leaf_key = make_cert("Test Apple Leaf", issuer=intermediate, issuer_key=intermediate_key)
    return root, intermediate, leaf, leaf_key


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def sign_jws(payload: dict, leaf, leaf_key, chain: list) -> str:
    x5c = [
        base64.b64encode(cert.public_bytes(Encoding.DER)).decode() for cert in chain
    ]
    header = {"alg": "ES256", "x5c": x5c}
    encoded_header = b64url(json.dumps(header, separators=(",", ":")).encode())
    encoded_payload = b64url(json.dumps(payload, separators=(",", ":")).encode())
    der = leaf_key.sign(f"{encoded_header}.{encoded_payload}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    signature = b64url(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
    return f"{encoded_header}.{encoded_payload}.{signature}"
