from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.core.cache import CacheBackend
from app.core.errors import AppError, ConflictError, UnauthorizedError
from app.core.otp import OTPService
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.orm import (
    AuditLog,
    Preference,
    Profile,
    Session,
    User,
    UserAuth,
    UserStatus,
)
from app.repositories.users import (
    AuditLogRepository,
    PreferenceRepository,
    ProfileRepository,
    SessionRepository,
    UserAuthRepository,
    UserRepository,
)
from app.schemas.auth import PublicUser, RegisterResult, TokenPair


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        otp: OTPService,
        limiter: RateLimiter,
        cache: CacheBackend,
        request_id: str,
        ip: str | None,
        user_agent: str | None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._otp = otp
        self._limiter = limiter
        self._cache = cache
        self._request_id = request_id
        self._ip = ip
        self._user_agent = user_agent
        self._users = UserRepository(session)
        self._auths = UserAuthRepository(session)
        self._sessions = SessionRepository(session)
        self._profiles = ProfileRepository(session)
        self._preferences = PreferenceRepository(session)
        self._audit = AuditLogRepository(session)

    async def register(self, email: str, password: str, *, send_otp: bool = True) -> RegisterResult:
        limit, window = self._settings.rate_limit_policy("registration")
        await self._limiter.hit(f"register:{self._ip}", limit, window)
        await self._limiter.hit(f"register-email:{email.lower()}", limit, window)
        existing = await self._auths.get_by_email(email)
        if existing:
            raise ConflictError(
                "EMAIL_ALREADY_EXISTS", "An account with this email already exists."
            )
        user = User(status=UserStatus.ACTIVE.value, onboarding_completed=False)
        await self._users.add(user)
        auth = UserAuth(
            user_id=user.id,
            email=email.lower(),
            password_hash=hash_password(password),
        )
        await self._auths.add(auth)
        await self._profiles.add(Profile(user_id=user.id))
        await self._preferences.add(Preference(user_id=user.id))
        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise ConflictError(
                "EMAIL_ALREADY_EXISTS", "An account with this email already exists."
            ) from exc
        if send_otp:
            gen_limit, gen_window = RATE_LIMIT_POLICIES["otp_generation"]
            await self._limiter.hit(f"otp-gen:{email.lower()}", gen_limit, gen_window)
            await self._otp.issue(email.lower(), "signup")
        await self._write_audit(user.id, "auth.register")
        await self._session.commit()
        return RegisterResult(user_id=str(user.id), verification_required=True, email=email.lower())

    async def verify_otp(self, email: str, otp: str) -> TokenPair:
        limit, window = RATE_LIMIT_POLICIES["otp_verification"]
        await self._limiter.hit(f"otp-verify:{email.lower()}", limit, window)
        await self._otp.verify(email.lower(), "signup", otp)
        auth = await self._auths.get_by_email(email)
        if auth is None:
            raise AppError("AUTH_OTP_INVALID", "Invalid OTP.", 400)
        auth.email_verified_at = datetime.now(UTC)
        await self._write_audit(auth.user_id, "auth.verify_otp")
        tokens = await self._issue_tokens(auth.user_id)
        await self._session.commit()
        return tokens

    async def login(self, email: str, password: str, device_id: str | None) -> TokenPair:
        limit, window = self._settings.rate_limit_policy("login")
        await self._limiter.hit(f"login:{self._ip}", limit, window)
        await self._limiter.hit(f"login-email:{email.lower()}", limit, window)
        auth = await self._auths.get_by_email(email)
        if auth is None or not auth.password_hash or not verify_password(password, auth.password_hash):
            await self._write_audit(None, "auth.login_failed")
            await self._session.commit()
            raise UnauthorizedError(
                "Invalid email or password.",
                code="AUTH_INVALID_CREDENTIALS",
            )
        if auth.email_verified_at is None:
            raise UnauthorizedError(
                "Please verify your email before signing in.",
                code="AUTH_ACCOUNT_NOT_VERIFIED",
                status_code=403,
            )
        user = await self._users.get_by_id(auth.user_id)
        self._assert_login_allowed(user)
        user.last_active_at = datetime.now(UTC)
        await self._write_audit(user.id, "auth.login")
        tokens = await self._issue_tokens(user.id, device_id=device_id)
        await self._session.commit()
        return tokens

    async def refresh(self, refresh_token: str) -> TokenPair:
        await self._limiter.hit(f"refresh:{self._ip}", 30, 900)
        stored = await self._sessions.get_by_refresh_hash(hash_token(refresh_token))
        now = datetime.now(UTC)
        if stored is None:
            raise UnauthorizedError("Refresh token is invalid.", code="AUTH_SESSION_EXPIRED")
        if stored.revoked_at is not None:
            await self._sessions.revoke_family(stored.family_id)
            await self._write_audit(stored.user_id, "auth.refresh_reuse")
            await self._session.commit()
            raise UnauthorizedError(
                "Refresh token reuse detected.",
                code="AUTH_SESSION_EXPIRED",
            )
        if stored.expires_at < now:
            raise UnauthorizedError("Refresh token is invalid.", code="AUTH_SESSION_EXPIRED")
        user = await self._users.get_by_id(stored.user_id)
        self._assert_login_allowed(user)
        stored.revoked_at = now
        tokens = await self._issue_tokens(user.id, device_id=stored.device_id, replaced=stored)
        await self._write_audit(user.id, "auth.refresh")
        await self._session.commit()
        return tokens

    async def logout(self, refresh_token: str | None, access_token: str | None) -> None:
        now = datetime.now(UTC)
        if refresh_token:
            stored = await self._sessions.get_by_refresh_hash(hash_token(refresh_token))
            if stored and stored.revoked_at is None:
                stored.revoked_at = now
                await self._write_audit(stored.user_id, "auth.logout")
        if access_token:
            try:
                payload = decode_token(self._settings, access_token)
                jti = payload.get("jti")
                exp = payload.get("exp")
                if jti and exp:
                    ttl = max(int(exp) - int(now.timestamp()), 1)
                    await self._cache.set(f"revoked:{jti}", "1", ex=ttl)
            except (ExpiredSignatureError, InvalidTokenError):
                pass
        await self._session.commit()

    async def forgot_password(self, email: str) -> dict:
        limit, window = RATE_LIMIT_POLICIES["forgot_password"]
        await self._limiter.hit(f"forgot:{self._ip}", limit, window)
        await self._limiter.hit(f"forgot-email:{email.lower()}", limit, window)
        auth = await self._auths.get_by_email(email)
        if auth:
            gen_limit, gen_window = RATE_LIMIT_POLICIES["otp_generation"]
            await self._limiter.hit(f"otp-gen:{email.lower()}", gen_limit, gen_window)
            await self._otp.issue(email.lower(), "reset")
            await self._write_audit(auth.user_id, "auth.forgot_password")
            await self._session.commit()
        return {"otpSent": True}

    async def reset_password(self, email: str, otp: str, password: str) -> None:
        await self._limiter.hit(f"reset:{email.lower()}", 5, 3600)
        await self._otp.verify(email.lower(), "reset", otp)
        auth = await self._auths.get_by_email(email)
        if auth is None:
            raise AppError("AUTH_OTP_INVALID", "Invalid OTP.", 400)
        auth.password_hash = hash_password(password)
        if auth.email_verified_at is None:
            auth.email_verified_at = datetime.now(UTC)
        await self._sessions.revoke_all_for_user(auth.user_id)
        await self._write_audit(auth.user_id, "auth.reset_password")
        await self._session.commit()

    async def me(self, user_id: UUID) -> PublicUser:
        result = await self._session.execute(
            select(User)
            .options(selectinload(User.auth), selectinload(User.profile))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise UnauthorizedError()
        auth = user.auth
        profile = user.profile
        return PublicUser(
            id=str(user.id),
            email=auth.email if auth else "",
            email_verified=bool(auth and auth.email_verified_at),
            onboarding_completed=user.onboarding_completed,
            last_active_at=user.last_active_at.isoformat() if user.last_active_at else None,
            created_at=user.created_at.isoformat(),
            display_name=profile.display_name if profile else None,
            verification_status=profile.verification_status if profile else "UNVERIFIED",
            visibility=profile.visibility if profile else "PUBLIC",
            role=user.role,
        )

    async def resolve_user(self, token: str) -> User:
        try:
            payload = decode_token(self._settings, token)
        except ExpiredSignatureError as exc:
            raise UnauthorizedError("Access token expired.", code="AUTH_SESSION_EXPIRED") from exc
        except InvalidTokenError as exc:
            raise UnauthorizedError("Invalid access token.", code="AUTH_SESSION_EXPIRED") from exc
        if payload.get("typ") != "access":
            raise UnauthorizedError("Invalid access token.", code="AUTH_SESSION_EXPIRED")
        jti = payload.get("jti")
        if jti and await self._cache.get(f"revoked:{jti}"):
            raise UnauthorizedError("Access token revoked.", code="AUTH_SESSION_EXPIRED")
        user_id = UUID(str(payload["sub"]))
        session_id = UUID(str(payload["sid"]))
        stored = await self._sessions.get_by_id(session_id)
        if stored is None or stored.revoked_at is not None:
            raise UnauthorizedError(
                "Signed in on another device.",
                code="AUTH_SESSION_EXPIRED",
            )
        user = await self._users.get_by_id(user_id)
        if self._assert_login_allowed(user):
            await self._session.commit()
        return user

    def _assert_login_allowed(self, user: User | None) -> bool:
        if user is None:
            raise UnauthorizedError(
                "Invalid email or password.",
                code="AUTH_INVALID_CREDENTIALS",
            )
        if user.status == UserStatus.SUSPENDED.value:
            until = user.suspended_until
            if until is not None:
                if until.tzinfo is None:
                    until = until.replace(tzinfo=UTC)
                if until <= datetime.now(UTC):
                    user.status = UserStatus.ACTIVE.value
                    user.suspended_until = None
                    return True
            raise UnauthorizedError(
                "This account cannot sign in.",
                code="AUTH_ACCOUNT_SUSPENDED",
                status_code=403,
            )
        if user.status in {
            UserStatus.BANNED.value,
            UserStatus.DELETED.value,
            UserStatus.PENDING_DELETION.value,
        }:
            raise UnauthorizedError(
                "This account cannot sign in.",
                code="AUTH_ACCOUNT_SUSPENDED",
                status_code=403,
            )
        return False

    async def _issue_tokens(
        self,
        user_id: UUID,
        device_id: str | None = None,
        replaced: Session | None = None,
    ) -> TokenPair:
        if replaced is None:
            await self._sessions.revoke_all_for_user(user_id)
        raw_refresh = secrets.token_urlsafe(48)
        expires = datetime.now(UTC) + timedelta(days=self._settings.refresh_token_expire_days)
        session = Session(
            user_id=user_id,
            family_id=replaced.family_id if replaced is not None else uuid4(),
            refresh_token_hash=hash_token(raw_refresh),
            device_id=device_id,
            user_agent=self._user_agent,
            ip_address=self._ip,
            expires_at=expires,
        )
        await self._sessions.add(session)
        if replaced is not None:
            replaced.replaced_by_id = session.id
        access, access_exp = create_access_token(self._settings, str(user_id), str(session.id))
        return TokenPair(
            access_token=access,
            refresh_token=raw_refresh,
            access_expires_at=access_exp.isoformat(),
            refresh_expires_at=expires.isoformat(),
            user_id=str(user_id),
        )

    async def resend_otp(self, email: str, purpose: str) -> dict:
        if purpose not in {"signup", "reset", "login"}:
            raise AppError("VALIDATION_ERROR", "Invalid OTP purpose.", 422)
        gen_limit, gen_window = RATE_LIMIT_POLICIES["otp_generation"]
        await self._limiter.hit(f"otp-gen:{email.lower()}", gen_limit, gen_window)
        auth = await self._auths.get_by_email(email)
        if auth:
            await self._otp.issue(email.lower(), purpose)
            await self._write_audit(auth.user_id, "auth.resend_otp")
            await self._session.commit()
        return {"otpSent": True}

    async def peek_dev_otp(self, email: str, purpose: str) -> dict:
        if self._settings.is_production:
            raise AppError("NOT_FOUND", "Not found.", 404)
        code = await self._otp.peek_dev(email, purpose)
        return {"otp": code}

    async def _write_audit(self, user_id: UUID | None, action: str) -> None:
        await self._audit.add(
            AuditLog(
                user_id=user_id,
                action=action,
                ip_address=self._ip,
                user_agent=self._user_agent,
                request_id=self._request_id,
                metadata_json=None,
            )
        )
