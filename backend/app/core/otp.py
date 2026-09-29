from __future__ import annotations

import asyncio
import logging
import secrets
import smtplib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from email.message import EmailMessage

from app.config import Settings
from app.core.cache import CacheBackend
from app.core.errors import AppError, RateLimitError

logger = logging.getLogger(__name__)

def otp_email_message(destination: str, code: str, purpose: str, expire_minutes: int) -> tuple[str, str]:
    action = {
        "signup": "verify your email",
        "login": "sign in",
        "reset": "reset your password",
        "email_change": "confirm your new email",
    }.get(purpose, "continue")
    subject = f"{code} is your BoomBoom code"
    body = (
        f"Hi,\n\n"
        f"Use this code to {action}:\n\n"
        f"{code}\n\n"
        f"This {len(code)}-digit code expires in {expire_minutes} minutes. "
        "Do not share it with anyone.\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "— BoomBoom"
    )
    return subject, body


@dataclass
class OtpChallenge:
    code: str
    attempts: int
    created_at: str
    purpose: str


class OTPProvider(ABC):
    @abstractmethod
    async def deliver(self, destination: str, code: str, purpose: str) -> None: ...


class MockOTPProvider(OTPProvider):
    """Development provider. Does not send SMS/email."""

    async def deliver(self, destination: str, code: str, purpose: str) -> None:
        return


class SmtpOTPProvider(OTPProvider):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def deliver(self, destination: str, code: str, purpose: str) -> None:
        expire_minutes = max(self._settings.otp_expire_seconds // 60, 1)
        subject, body = otp_email_message(destination, code, purpose, expire_minutes)
        message = EmailMessage()
        sender = self._settings.smtp_from_email.strip() or self._settings.smtp_username
        from_name = self._settings.smtp_from_name.strip() or "BoomBoom"
        message["Subject"] = subject
        message["From"] = f"{from_name} <{sender}>"
        message["To"] = destination
        message.set_content(body)
        try:
            await asyncio.to_thread(self._send, message, sender)
        except Exception:
            logger.exception("otp_email_failed destination=%s purpose=%s", destination, purpose)
            raise AppError("AUTH_OTP_DELIVERY_FAILED", "Unable to send the login code.", 502)

    def _send(self, message: EmailMessage, sender: str) -> None:
        password = self._settings.smtp_password.replace(" ", "")
        with smtplib.SMTP(self._settings.smtp_host, self._settings.smtp_port, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(self._settings.smtp_username, password)
            smtp.send_message(message, from_addr=sender)


class OTPService:
    def __init__(self, cache: CacheBackend, settings: Settings, provider: OTPProvider) -> None:
        self._cache = cache
        self._settings = settings
        self._provider = provider

    def _key(self, purpose: str, destination: str) -> str:
        return f"otp:{purpose}:{destination.lower()}"

    def _cooldown_key(self, purpose: str, destination: str) -> str:
        return f"otp-cd:{purpose}:{destination.lower()}"

    def _dev_key(self, purpose: str, destination: str) -> str:
        return f"otp-dev:{purpose}:{destination.lower()}"

    async def peek_dev(self, destination: str, purpose: str) -> str | None:
        if self._settings.is_production:
            return None
        return await self._cache.get(self._dev_key(purpose, destination))

    async def issue(self, destination: str, purpose: str) -> None:
        cooldown = await self._cache.get(self._cooldown_key(purpose, destination))
        if cooldown is not None:
            raise RateLimitError("Please wait before requesting another code.")
        code = "".join(secrets.choice("0123456789") for _ in range(self._settings.otp_length))
        payload = OtpChallenge(
            code=code,
            attempts=0,
            created_at=datetime.now(UTC).isoformat(),
            purpose=purpose,
        )
        await self._cache.set(
            self._key(purpose, destination),
            f"{payload.code}|{payload.attempts}|{payload.created_at}|{payload.purpose}",
            ex=self._settings.otp_expire_seconds,
        )
        await self._cache.set(
            self._cooldown_key(purpose, destination),
            "1",
            ex=self._settings.otp_resend_seconds,
        )
        if not self._settings.is_production:
            await self._cache.set(
                self._dev_key(purpose, destination),
                code,
                ex=self._settings.otp_expire_seconds,
            )
            logger.info("otp_mock destination=%s purpose=%s code=%s", destination, purpose, code)
        try:
            await self._provider.deliver(destination, code, purpose)
        except Exception:
            await self._cache.delete(self._key(purpose, destination))
            await self._cache.delete(self._cooldown_key(purpose, destination))
            await self._cache.delete(self._dev_key(purpose, destination))
            raise

    async def verify(self, destination: str, purpose: str, code: str) -> None:
        raw = await self._cache.get(self._key(purpose, destination))
        if raw is None:
            raise AppError("AUTH_OTP_EXPIRED", "OTP expired or was not requested.", 400)
        stored_code, attempts_s, _created, _purpose = raw.split("|", 3)
        attempts = int(attempts_s)
        if attempts >= self._settings.otp_max_attempts:
            await self._cache.delete(self._key(purpose, destination))
            raise AppError("AUTH_OTP_LOCKED", "Too many incorrect OTP attempts.", 429)
        if stored_code != code.strip():
            attempts += 1
            ttl = self._settings.otp_expire_seconds
            await self._cache.set(
                self._key(purpose, destination),
                f"{stored_code}|{attempts}|{_created}|{_purpose}",
                ex=ttl,
            )
            remaining = self._settings.otp_max_attempts - attempts
            raise AppError(
                "AUTH_OTP_INVALID",
                f"Invalid OTP. {max(remaining, 0)} attempts remaining.",
                400,
            )
        await self._cache.delete(self._key(purpose, destination))
        await self._cache.delete(self._cooldown_key(purpose, destination))

    async def clear_destination(self, destination: str) -> None:
        for purpose in ("signup", "login", "reset", "email_change"):
            await self._cache.delete(self._key(purpose, destination))
            await self._cache.delete(self._cooldown_key(purpose, destination))
            await self._cache.delete(self._dev_key(purpose, destination))
