from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from app.config import Settings

logger = logging.getLogger(__name__)

INVALID_CODES = frozenset(
    {
        "UNREGISTERED",
        "NOT_FOUND",
        "INVALID_ARGUMENT",
        "SENDER_ID_MISMATCH",
        "registration-token-not-registered",
        "invalid-registration-token",
    }
)


@dataclass
class PushResult:
    success_count: int = 0
    failure_count: int = 0
    invalid_tokens: list[str] = field(default_factory=list)
    retryable: bool = False
    error_code: str | None = None


class PushProvider(Protocol):
    async def send(
        self,
        tokens: list[str],
        *,
        title: str,
        body: str,
        data: dict[str, str],
        collapse_key: str | None = None,
    ) -> PushResult: ...


class NoopPushProvider:
    async def send(
        self,
        tokens: list[str],
        *,
        title: str,
        body: str,
        data: dict[str, str],
        collapse_key: str | None = None,
    ) -> PushResult:
        logger.info("fcm_noop token_count=%s type=%s", len(tokens), data.get("type"))
        return PushResult(success_count=0, failure_count=0)


class RecordingPushProvider:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.invalid_tokens: set[str] = set()
        self.fail_retryable = False
        self.fail_once = False

    async def send(
        self,
        tokens: list[str],
        *,
        title: str,
        body: str,
        data: dict[str, str],
        collapse_key: str | None = None,
    ) -> PushResult:
        if self.fail_retryable or self.fail_once:
            self.fail_once = False
            return PushResult(failure_count=len(tokens), retryable=True, error_code="UNAVAILABLE")
        invalid = [token for token in tokens if token in self.invalid_tokens]
        valid = [token for token in tokens if token not in self.invalid_tokens]
        self.sent.append(
            {
                "token_count": len(tokens),
                "title": title,
                "data": dict(data),
                "collapse_key": collapse_key,
            }
        )
        return PushResult(
            success_count=len(valid),
            failure_count=len(invalid),
            invalid_tokens=invalid,
            error_code="UNREGISTERED" if invalid else None,
        )


class FirebasePushProvider:
    def __init__(self, app: Any) -> None:
        self._app = app

    async def send(
        self,
        tokens: list[str],
        *,
        title: str,
        body: str,
        data: dict[str, str],
        collapse_key: str | None = None,
    ) -> PushResult:
        if not tokens:
            return PushResult()
        try:
            from firebase_admin import messaging
        except ImportError:
            return PushResult(retryable=False, error_code="SDK_MISSING")

        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=data,
            android=messaging.AndroidConfig(
                collapse_key=collapse_key,
                priority="high",
                notification=messaging.AndroidNotification(channel_id="boomboom_default"),
            ),
            apns=messaging.APNSConfig(
                headers={"apns-collapse-id": collapse_key or "boomboom"},
                payload=messaging.APNSPayload(aps=messaging.Aps(sound="default")),
            ),
        )
        try:
            response = messaging.send_each_for_multicast(message, app=self._app)
        except Exception as exc:
            logger.info("fcm_provider_error code=%s", type(exc).__name__)
            return PushResult(
                failure_count=len(tokens), retryable=True, error_code=type(exc).__name__
            )

        invalid: list[str] = []
        retryable = False
        error_code = None
        for index, item in enumerate(response.responses):
            if item.success:
                continue
            exc = item.exception
            code = getattr(exc, "code", None) or type(exc).__name__
            error_code = str(code)
            if str(code) in INVALID_CODES or "UNREGISTERED" in str(code).upper():
                invalid.append(tokens[index])
            else:
                retryable = True
        return PushResult(
            success_count=int(response.success_count),
            failure_count=int(response.failure_count),
            invalid_tokens=invalid,
            retryable=retryable and not invalid,
            error_code=error_code,
        )


def build_push_provider(settings: Settings) -> PushProvider:
    creds = (settings.firebase_credentials_json or "").strip()
    if not creds:
        return NoopPushProvider()
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.info("fcm_sdk_missing")
        return NoopPushProvider()

    try:
        path = Path(creds)
        if path.is_file():
            cred = credentials.Certificate(str(path))
        else:
            cred = credentials.Certificate(json.loads(creds))
        options = {}
        if settings.firebase_project_id:
            options["projectId"] = settings.firebase_project_id
        if firebase_admin._apps:
            app = firebase_admin.get_app()
        else:
            app = firebase_admin.initialize_app(cred, options or None)
        return FirebasePushProvider(app)
    except Exception as exc:
        logger.info("fcm_init_failed code=%s", type(exc).__name__)
        return NoopPushProvider()
