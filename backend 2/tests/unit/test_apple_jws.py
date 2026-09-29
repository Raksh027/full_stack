import pytest

from app.core.apple_trust import apple_root_certificates
from app.services.apple_jws import AppleJwsError, AppleJwsVerifier, expected_apple_environment
from tests.unit.jws_test_support import apple_test_chain, make_cert, sign_jws


def _txn(**overrides):
    payload = {
        "bundleId": "com.boomboom.app",
        "productId": "com.boomboom.premium.monthly",
        "transactionId": "txn-1",
        "originalTransactionId": "orig-1",
        "environment": "Sandbox",
        "signedDate": 1710000000000,
        "expiresDate": 1810000000000,
    }
    payload.update(overrides)
    return payload


def test_valid_signed_payload_and_nested() -> None:
    root, intermediate, leaf, key = apple_test_chain()
    verifier = AppleJwsVerifier(trusted_roots=(root,))
    txn = sign_jws(_txn(), leaf, key, [leaf, intermediate, root])
    renewal = sign_jws(
        {
            "originalTransactionId": "orig-1",
            "autoRenewProductId": "com.boomboom.premium.monthly",
            "environment": "Sandbox",
        },
        leaf,
        key,
        [leaf, intermediate],
    )
    outer = sign_jws(
        {
            "notificationType": "DID_RENEW",
            "notificationUUID": "uuid-1",
            "data": {
                "bundleId": "com.boomboom.app",
                "environment": "Sandbox",
                "signedTransactionInfo": txn,
                "signedRenewalInfo": renewal,
            },
            "signedDate": 1710000000000,
        },
        leaf,
        key,
        [leaf, intermediate],
    )
    note = verifier.verify_notification(
        outer, expected_bundle_id="com.boomboom.app", expected_environment="Sandbox"
    )
    assert note.notification_uuid == "uuid-1"
    assert note.original_transaction_id == "orig-1"
    assert note.product_id == "com.boomboom.premium.monthly"


def test_malformed_and_missing_x5c() -> None:
    verifier = AppleJwsVerifier(trusted_roots=apple_test_chain()[:1])
    with pytest.raises(AppleJwsError):
        verifier.verify_compact("not-a-jws")
    root, intermediate, leaf, key = apple_test_chain()
    token = sign_jws(_txn(), leaf, key, [leaf, intermediate])
    header, payload, sig = token.split(".")
    import base64
    import json

    raw = json.loads(base64.urlsafe_b64decode(header + "=="))
    raw.pop("x5c")
    bad_header = base64.urlsafe_b64encode(json.dumps(raw).encode()).rstrip(b"=").decode()
    with pytest.raises(AppleJwsError):
        verifier.verify_compact(f"{bad_header}.{payload}.{sig}")


def test_wrong_root_and_wrong_intermediate() -> None:
    root, intermediate, leaf, key = apple_test_chain()
    other_root, other_key = make_cert("Other Root", ca=True)
    verifier = AppleJwsVerifier(trusted_roots=(other_root,))
    token = sign_jws(_txn(), leaf, key, [leaf, intermediate, root])
    with pytest.raises(AppleJwsError):
        verifier.verify_compact(token)
    rogue_int, rogue_key = make_cert(
        "Rogue Intermediate", issuer=other_root, issuer_key=other_key, ca=True
    )
    rogue_leaf, rogue_leaf_key = make_cert("Rogue Leaf", issuer=rogue_int, issuer_key=rogue_key)
    forged = sign_jws(_txn(), rogue_leaf, rogue_leaf_key, [rogue_leaf, rogue_int, root])
    trusted = AppleJwsVerifier(trusted_roots=(root,))
    with pytest.raises(AppleJwsError):
        trusted.verify_compact(forged)


def test_expired_certificate() -> None:
    root, root_key = make_cert("Root", ca=True)
    intermediate, intermediate_key = make_cert("WWDR", issuer=root, issuer_key=root_key, ca=True)
    leaf, leaf_key = make_cert(
        "Expired Leaf",
        issuer=intermediate,
        issuer_key=intermediate_key,
        days=-1,
        not_before_days=-10,
    )
    token = sign_jws(_txn(), leaf, leaf_key, [leaf, intermediate])
    with pytest.raises(AppleJwsError):
        AppleJwsVerifier(trusted_roots=(root,)).verify_compact(token)


def test_invalid_signature_and_modified_nested() -> None:
    root, intermediate, leaf, key = apple_test_chain()
    verifier = AppleJwsVerifier(trusted_roots=(root,))
    token = sign_jws(_txn(), leaf, key, [leaf, intermediate])
    header, payload, sig = token.split(".")
    with pytest.raises(AppleJwsError):
        verifier.verify_compact(f"{header}.{payload}.{sig[:-2]}aa")
    good_txn = sign_jws(_txn(), leaf, key, [leaf, intermediate])
    tampered = good_txn[:-4] + "abcd"
    outer = sign_jws(
        {
            "notificationType": "DID_RENEW",
            "notificationUUID": "uuid-2",
            "data": {
                "bundleId": "com.boomboom.app",
                "environment": "Sandbox",
                "signedTransactionInfo": tampered,
            },
        },
        leaf,
        key,
        [leaf, intermediate],
    )
    with pytest.raises(AppleJwsError):
        verifier.verify_notification(
            outer, expected_bundle_id="com.boomboom.app", expected_environment="Sandbox"
        )


def test_wrong_bundle_and_environment() -> None:
    root, intermediate, leaf, key = apple_test_chain()
    verifier = AppleJwsVerifier(trusted_roots=(root,))
    txn = sign_jws(_txn(), leaf, key, [leaf, intermediate])
    outer = sign_jws(
        {
            "notificationType": "SUBSCRIBED",
            "notificationUUID": "uuid-3",
            "data": {
                "bundleId": "com.other.app",
                "environment": "Sandbox",
                "signedTransactionInfo": txn,
            },
        },
        leaf,
        key,
        [leaf, intermediate],
    )
    with pytest.raises(AppleJwsError):
        verifier.verify_notification(
            outer, expected_bundle_id="com.boomboom.app", expected_environment="Sandbox"
        )
    good = sign_jws(
        {
            "notificationType": "SUBSCRIBED",
            "notificationUUID": "uuid-4",
            "data": {
                "bundleId": "com.boomboom.app",
                "environment": "Sandbox",
                "signedTransactionInfo": txn,
            },
        },
        leaf,
        key,
        [leaf, intermediate],
    )
    with pytest.raises(AppleJwsError):
        verifier.verify_notification(
            good, expected_bundle_id="com.boomboom.app", expected_environment="Production"
        )


def test_pinned_apple_root_loads() -> None:
    roots = apple_root_certificates()
    assert len(roots) == 1
    assert "Apple Root CA - G3" in roots[0].subject.rfc4514_string()


def test_expected_environment_auto() -> None:
    assert expected_apple_environment("production", "auto") == "Production"
    assert expected_apple_environment("development", "auto") == "Sandbox"
    assert expected_apple_environment("production", "Sandbox") == "Sandbox"
