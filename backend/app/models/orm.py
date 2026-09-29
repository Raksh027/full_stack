from __future__ import annotations

from datetime import UTC, date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class UserStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    BANNED = "BANNED"
    PENDING_DELETION = "PENDING_DELETION"
    DELETED = "DELETED"


class UserRole(StrEnum):
    USER = "USER"
    REVIEWER = "REVIEWER"
    ADMIN = "ADMIN"


class ProfileVisibility(StrEnum):
    PUBLIC = "PUBLIC"
    HIDDEN = "HIDDEN"
    MATCHES_ONLY = "MATCHES_ONLY"


class VerificationStatus(StrEnum):
    UNVERIFIED = "UNVERIFIED"
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class VerificationType(StrEnum):
    PROFILE_VERIFICATION = "PROFILE_VERIFICATION"
    SELFIE_VERIFICATION = "SELFIE_VERIFICATION"


class VerificationRequestStatus(StrEnum):
    PENDING = "PENDING"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class VerificationRejectionReason(StrEnum):
    IMAGE_UNCLEAR = "IMAGE_UNCLEAR"
    FACE_NOT_VISIBLE = "FACE_NOT_VISIBLE"
    DUPLICATE_SUBMISSION = "DUPLICATE_SUBMISSION"
    INVALID_SUBMISSION = "INVALID_SUBMISSION"
    FAILED_VERIFICATION = "FAILED_VERIFICATION"


class VerificationReviewAction(StrEnum):
    START_REVIEW = "START_REVIEW"
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class ReportStatus(StrEnum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class ReportReason(StrEnum):
    HARASSMENT = "HARASSMENT"
    SPAM = "SPAM"
    SCAM = "SCAM"
    IMPERSONATION = "IMPERSONATION"
    INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT"
    MINOR_SAFETY_CONCERN = "MINOR_SAFETY_CONCERN"
    FRAUD = "FRAUD"
    ABUSIVE_BEHAVIOR = "ABUSIVE_BEHAVIOR"
    OTHER = "OTHER"


class ReportSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ModerationActionType(StrEnum):
    WARN = "WARN"
    SUSPEND = "SUSPEND"
    BAN = "BAN"
    RESTORE = "RESTORE"
    DISMISS_REPORT = "DISMISS_REPORT"
    REMOVE_PROFILE_MEDIA = "REMOVE_PROFILE_MEDIA"
    REJECT_VERIFICATION = "REJECT_VERIFICATION"


class EventStatus(StrEnum):
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"
    HIDDEN = "HIDDEN"


class EventRsvpStatus(StrEnum):
    GOING = "GOING"
    CANCELLED = "CANCELLED"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=UserStatus.ACTIVE.value)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    onboarding_step: Mapped[str] = mapped_column(String(32), nullable=False, default="gender")
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=UserRole.USER.value)
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    auth: Mapped[UserAuth | None] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    profile: Mapped[Profile | None] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    preferences: Mapped[Preference | None] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    location: Mapped[Location | None] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list[Session]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    device_tokens: Mapped[list[DeviceToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list[AuditLog]] = relationship(
        back_populates="user",
        foreign_keys="AuditLog.user_id",
    )
    hosted_events: Mapped[list[SocialEvent]] = relationship(
        back_populates="host",
        foreign_keys="SocialEvent.host_user_id",
    )
    event_rsvps: Mapped[list[EventRsvp]] = relationship(
        back_populates="user",
        foreign_keys="EventRsvp.user_id",
    )

    __table_args__ = (
        Index("ix_users_status", "status"),
        Index("ix_users_last_active_at", "last_active_at"),
    )


class UserAuth(TimestampMixin, Base):
    __tablename__ = "user_auth"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="email")
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    email_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="auth")

    __table_args__ = (
        UniqueConstraint("email", name="uq_user_auth_email"),
        Index("ix_user_auth_email", "email"),
    )


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(40), nullable=True)
    orientation: Mapped[str | None] = mapped_column(String(40), nullable=True)
    looking_for: Mapped[str | None] = mapped_column(String(80), nullable=True)
    show_orientation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    languages: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    work_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    company: Mapped[str | None] = mapped_column(String(120), nullable=True)
    school: Mapped[str | None] = mapped_column(String(120), nullable=True)
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lifestyle: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(80), nullable=True)
    visibility: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ProfileVisibility.PUBLIC.value
    )
    verification_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=VerificationStatus.UNVERIFIED.value
    )

    user: Mapped[User] = relationship(back_populates="profile")
    media: Mapped[list[ProfileMedia]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    interests: Mapped[list[ProfileInterest]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_profiles_visibility", "visibility"),
        Index("ix_profiles_gender", "gender"),
        Index("ix_profiles_birth_date", "birth_date"),
    )


class ProfileMedia(TimestampMixin, Base):
    __tablename__ = "profile_media"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    profile_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    media_type: Mapped[str] = mapped_column(String(32), nullable=False, default="image")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    moderation_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    profile: Mapped[Profile] = relationship(back_populates="media")

    __table_args__ = (
        Index("ix_profile_media_profile_id", "profile_id"),
        UniqueConstraint("storage_key", name="uq_profile_media_storage_key"),
        Index("ix_profile_media_profile_active", "profile_id", "deleted_at"),
    )


class Interest(TimestampMixin, Base):
    __tablename__ = "interests"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)

    profiles: Mapped[list[ProfileInterest]] = relationship(back_populates="interest")

    __table_args__ = (UniqueConstraint("slug", name="uq_interests_slug"),)


class ProfileInterest(Base):
    __tablename__ = "profile_interests"

    profile_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    interest_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("interests.id", ondelete="CASCADE"),
        primary_key=True,
    )

    profile: Mapped[Profile] = relationship(back_populates="interests")
    interest: Mapped[Interest] = relationship(back_populates="profiles")


class Preference(TimestampMixin, Base):
    __tablename__ = "preferences"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    min_age: Mapped[int] = mapped_column(Integer, nullable=False, default=18)
    max_age: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    max_distance_km: Mapped[float] = mapped_column(Float, nullable=False, default=50)
    gender_filter: Mapped[str] = mapped_column(String(40), nullable=False, default="Everyone")
    orientation_filter: Mapped[str | None] = mapped_column(String(40), nullable=True)
    looking_for_filter: Mapped[str | None] = mapped_column(String(80), nullable=True)
    verified_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_discoverable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    online_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    filters: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    user: Mapped[User] = relationship(back_populates="preferences")


class Location(TimestampMixin, Base):
    __tablename__ = "locations"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    geog: Mapped[str | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    locality: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    region: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    country_flag: Mapped[str | None] = mapped_column(String(512), nullable=True)
    location_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="location")

    __table_args__ = (Index("ix_locations_geog", "geog", postgresql_using="gist"),)


class DeviceToken(TimestampMixin, Base):
    __tablename__ = "device_tokens"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="device_tokens")

    __table_args__ = (
        UniqueConstraint("token", name="uq_device_tokens_token"),
        Index("ix_device_tokens_user_id", "user_id"),
        Index("ix_device_tokens_token", "token"),
        Index("ix_device_tokens_user_active", "user_id", "is_active"),
    )


class NotificationType(StrEnum):
    LIKE_RECEIVED = "LIKE_RECEIVED"
    OFFER_RECEIVED = "OFFER_RECEIVED"
    MATCH_CREATED = "MATCH_CREATED"
    NEW_MESSAGE = "NEW_MESSAGE"
    FAVORITE_RECEIVED = "FAVORITE_RECEIVED"
    PROFILE_ACTIVITY = "PROFILE_ACTIVITY"
    PROFILE_VIEW = "PROFILE_VIEW"
    VERIFICATION_RESULT = "VERIFICATION_RESULT"
    VERIFICATION_SUBMITTED = "VERIFICATION_SUBMITTED"
    VERIFICATION_APPROVED = "VERIFICATION_APPROVED"
    VERIFICATION_REJECTED = "VERIFICATION_REJECTED"
    SUBSCRIPTION_EVENT = "SUBSCRIPTION_EVENT"
    EVENT_UPDATE = "EVENT_UPDATE"
    TRAVEL_UPDATE = "TRAVEL_UPDATE"
    SAFETY_ALERT = "SAFETY_ALERT"


class NotificationDeliveryStatus(StrEnum):
    CREATED = "CREATED"
    QUEUED = "QUEUED"
    SENT = "SENT"
    FAILED = "FAILED"
    INVALID_TOKEN = "INVALID_TOKEN"


class AppNotification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(320), nullable=False)
    data_json: Mapped[dict | None] = mapped_column("data", JSONB, nullable=True)
    related_entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    related_entity_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    event_key: Mapped[str] = mapped_column(String(160), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=NotificationDeliveryStatus.CREATED.value
    )

    __table_args__ = (
        UniqueConstraint("user_id", "event_key", name="uq_notifications_user_event"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )


class NotificationPreference(TimestampMixin, Base):
    __tablename__ = "notification_preferences"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    matches: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    likes: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    favorites: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    messages: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    message_preview: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    general: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    all_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    profile_views: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    cross_path: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    traveller_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    free_tonight: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (Index("ix_notification_preferences_user_id", "user_id"),)


class Session(TimestampMixin, Base):
    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    family_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, default=uuid4)
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="sessions")

    __table_args__ = (
        UniqueConstraint("refresh_token_hash", name="uq_sessions_refresh_token_hash"),
        Index("ix_sessions_user_id", "user_id"),
        Index("ix_sessions_expires_at", "expires_at"),
        Index("ix_sessions_family_id", "family_id"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    target_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[User | None] = relationship(
        back_populates="audit_logs",
        foreign_keys=[user_id],
    )

    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_actor_id", "actor_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_target", "target_type", "target_id"),
    )


class UserBlock(Base):
    __tablename__ = "user_blocks"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    blocker_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    blocked_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
        Index("ix_user_blocks_blocker_id", "blocker_id"),
        Index("ix_user_blocks_blocked_id", "blocked_id"),
    )


class DiscoveryImpression(Base):
    __tablename__ = "discovery_impressions"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    viewer_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    viewed_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_discovery_impressions_viewer_created", "viewer_id", "created_at"),
        Index("ix_discovery_impressions_pair", "viewer_id", "viewed_user_id"),
    )


class MatchStatus(StrEnum):
    ACTIVE = "ACTIVE"
    UNMATCHED = "UNMATCHED"


class ConversationStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class MessageType(StrEnum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    SYSTEM = "SYSTEM"


class MessageStatus(StrEnum):
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"


class Like(TimestampMixin, Base):
    __tablename__ = "likes"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    actor_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_superlike: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        UniqueConstraint("actor_id", "target_id", name="uq_likes_actor_target"),
        Index("ix_likes_actor_target", "actor_id", "target_id"),
        Index("ix_likes_target_actor", "target_id", "actor_id"),
        CheckConstraint("actor_id <> target_id", name="ck_likes_not_self"),
    )


class Favorite(TimestampMixin, Base):
    __tablename__ = "favorites"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "target_user_id", name="uq_favorites_user_target"),
        Index("ix_favorites_user_target", "user_id", "target_user_id"),
        Index("ix_favorites_user_created", "user_id", "created_at"),
        CheckConstraint("user_id <> target_user_id", name="ck_favorites_not_self"),
    )


class Match(TimestampMixin, Base):
    __tablename__ = "matches"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_a_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_b_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=MatchStatus.ACTIVE.value
    )
    unmatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unmatched_by_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_matches_pair"),
        CheckConstraint("user_a_id < user_b_id", name="ck_matches_canonical_order"),
        Index("ix_matches_user_a_id", "user_a_id"),
        Index("ix_matches_user_b_id", "user_b_id"),
        Index("ix_matches_status", "status"),
        Index("ix_matches_status_updated", "status", "updated_at"),
    )


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    match_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ConversationStatus.ACTIVE.value
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_preview: Mapped[str | None] = mapped_column(String(240), nullable=True)
    last_message_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("match_id", name="uq_conversations_match_id"),
        Index("ix_conversations_match_id", "match_id"),
        Index("ix_conversations_updated_at", "updated_at"),
        Index("ix_conversations_last_message_at", "last_message_at"),
    )


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    last_read_message_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_members_pair"),
        Index("ix_conversation_members_user_id", "user_id"),
        Index("ix_conversation_members_conversation_id", "conversation_id"),
    )


class Message(TimestampMixin, Base):
    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_message_id: Mapped[str] = mapped_column(String(80), nullable=False)
    message_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default=MessageType.TEXT.value
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    media_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=MessageStatus.SENT.value
    )

    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            "sender_id",
            "client_message_id",
            name="uq_messages_client_id",
        ),
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
        Index("ix_messages_conversation_sender", "conversation_id", "sender_id"),
        Index("ix_messages_conversation_status", "conversation_id", "status"),
    )


class VerificationRequest(TimestampMixin, Base):
    __tablename__ = "verification_requests"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    verification_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default=VerificationType.SELFIE_VERIFICATION.value,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=VerificationRequestStatus.PENDING.value,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewer_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    rejection_reason_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    provider_session_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    lock_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    media: Mapped[list[VerificationMedia]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    reviews: Mapped[list[VerificationReview]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_verification_requests_user_id", "user_id"),
        Index("ix_verification_requests_status", "status"),
        Index("ix_verification_requests_user_status", "user_id", "status"),
        Index("ix_verification_requests_user_created", "user_id", "created_at"),
        CheckConstraint(
            "verification_type IN ('PROFILE_VERIFICATION', 'SELFIE_VERIFICATION')",
            name="ck_verification_requests_type",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')",
            name="ck_verification_requests_status",
        ),
    )


class VerificationMedia(TimestampMixin, Base):
    __tablename__ = "verification_media"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    verification_request_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("verification_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    media_type: Mapped[str] = mapped_column(String(32), nullable=False, default="selfie")
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    request: Mapped[VerificationRequest] = relationship(back_populates="media")

    __table_args__ = (
        UniqueConstraint("storage_key", name="uq_verification_media_storage_key"),
        Index("ix_verification_media_request_id", "verification_request_id"),
    )


class VerificationReview(Base):
    __tablename__ = "verification_reviews"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    verification_request_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("verification_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    reviewer_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    reason_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    request: Mapped[VerificationRequest] = relationship(back_populates="reviews")

    __table_args__ = (
        Index("ix_verification_reviews_request_id", "verification_request_id"),
        Index("ix_verification_reviews_reviewer_id", "reviewer_id"),
        Index("ix_verification_reviews_created_at", "created_at"),
    )


class UserReport(TimestampMixin, Base):
    __tablename__ = "reports"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    reporter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    reported_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason_code: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_content_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    related_content_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=ReportStatus.OPEN.value)
    severity: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ReportSeverity.MEDIUM.value
    )
    assigned_reviewer_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolution_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("reporter_id <> reported_user_id", name="ck_reports_not_self"),
        Index("ix_reports_status", "status"),
        Index("ix_reports_severity", "severity"),
        Index("ix_reports_assigned_reviewer_id", "assigned_reviewer_id"),
        Index("ix_reports_created_at", "created_at"),
        Index("ix_reports_reported_user_id", "reported_user_id"),
        Index("ix_reports_reporter_id", "reporter_id"),
        Index("ix_reports_status_created", "status", "created_at"),
    )


class BillingPlatform(StrEnum):
    GOOGLE = "GOOGLE"
    APPLE = "APPLE"


class SubscriptionStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    GRACE_PERIOD = "GRACE_PERIOD"
    BILLING_RETRY = "BILLING_RETRY"
    PAUSED = "PAUSED"
    REVOKED = "REVOKED"


class EntitlementCode(StrEnum):
    PREMIUM = "PREMIUM"
    UNLIMITED_LIKES = "UNLIMITED_LIKES"
    SEE_LIKES = "SEE_LIKES"
    ADVANCED_FILTERS = "ADVANCED_FILTERS"
    BOOSTS = "BOOSTS"


class SubscriptionProduct(TimestampMixin, Base):
    __tablename__ = "subscription_products"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    product_id: Mapped[str] = mapped_column(String(128), nullable=False)
    plan_code: Mapped[str] = mapped_column(String(40), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    billing_period: Mapped[str] = mapped_column(String(16), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "platform", "product_id", name="uq_subscription_products_platform_product"
        ),
        Index("ix_subscription_products_plan_code", "plan_code"),
        Index("ix_subscription_products_active", "active"),
    )


class UserSubscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    product_id: Mapped[str] = mapped_column(String(128), nullable=False)
    plan_code: Mapped[str] = mapped_column(String(40), nullable=False)
    provider_ref_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_ref_hint: Mapped[str] = mapped_column(String(12), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=SubscriptionStatus.ACTIVE.value
    )
    auto_renewing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    grace_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_observed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("platform", "provider_ref_hash", name="uq_subscriptions_platform_ref"),
        Index("ix_subscriptions_user_id", "user_id"),
        Index("ix_subscriptions_status", "status"),
        Index("ix_subscriptions_expires_at", "expires_at"),
        Index("ix_subscriptions_product_id", "product_id"),
    )


class SubscriptionEvent(Base):
    __tablename__ = "subscription_events"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    provider_event_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(16), nullable=True)
    product_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    processing_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reconciliation_result: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("provider_event_id", name="uq_subscription_events_provider_event"),
        Index("ix_subscription_events_user_id", "user_id"),
        Index("ix_subscription_events_created_at", "created_at"),
    )


class UserEntitlement(TimestampMixin, Base):
    __tablename__ = "entitlements"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    product_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("user_id", "code", name="uq_entitlements_user_code"),
        Index("ix_entitlements_user_active", "user_id", "active"),
        Index("ix_entitlements_expires_at", "expires_at"),
    )


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="RECEIVED")
    platform: Mapped[str | None] = mapped_column(String(16), nullable=True)
    product_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    processing_result: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider_observed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("provider", "event_id", name="uq_billing_webhook_provider_event"),
        Index("ix_billing_webhook_status", "status"),
    )


class SocialEvent(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    host_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(4000), nullable=False, default="")
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cover_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=EventStatus.PUBLISHED.value
    )

    host: Mapped[User] = relationship(back_populates="hosted_events", foreign_keys=[host_user_id])
    rsvps: Mapped[list[EventRsvp]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("ends_at >= starts_at", name="ck_events_ends_after_starts"),
        CheckConstraint("capacity IS NULL OR capacity > 0", name="ck_events_capacity_positive"),
        CheckConstraint(
            "latitude IS NULL OR (latitude >= -90 AND latitude <= 90)",
            name="ck_events_latitude_range",
        ),
        CheckConstraint(
            "longitude IS NULL OR (longitude >= -180 AND longitude <= 180)",
            name="ck_events_longitude_range",
        ),
        Index("ix_events_starts_at", "starts_at"),
        Index("ix_events_host_user_id", "host_user_id"),
        Index("ix_events_status", "status"),
        Index("ix_events_status_starts_at_id", "status", "starts_at", "id"),
    )


class EventRsvp(TimestampMixin, Base):
    __tablename__ = "event_rsvps"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=EventRsvpStatus.GOING.value
    )

    event: Mapped[SocialEvent] = relationship(back_populates="rsvps")
    user: Mapped[User] = relationship(back_populates="event_rsvps", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_rsvps_event_user"),
        Index("ix_event_rsvps_event_id", "event_id"),
        Index("ix_event_rsvps_user_id", "user_id"),
        Index("ix_event_rsvps_event_status", "event_id", "status"),
    )


class DiscoverySwipe(Base):
    __tablename__ = "discovery_swipes"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    actor_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_discovery_swipes_actor_created", "actor_id", "created_at"),
        Index("ix_discovery_swipes_actor_target", "actor_id", "target_id"),
    )


class ProfileView(Base):
    __tablename__ = "profile_views"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    viewer_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    viewed_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_profile_views_viewed_created", "viewed_id", "created_at"),
        Index("ix_profile_views_viewer_viewed", "viewer_id", "viewed_id"),
    )


class TravelJourney(TimestampMixin, Base):
    __tablename__ = "travel_journeys"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    from_country: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    from_country_code: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    from_country_flag: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    from_state: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    to_city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    to_country: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    to_country_code: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    to_country_flag: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    to_state: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    departure: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    return_date: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    trip_type: Mapped[str] = mapped_column(String(40), nullable=False, default="vacation")
    travel_style: Mapped[str] = mapped_column(String(40), nullable=False, default="solo")
    companion: Mapped[str] = mapped_column(String(40), nullable=False, default="any")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="upcoming")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_image: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    hide_from_country: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hide_from: Mapped[str | None] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        Index("ix_travel_journeys_user_id", "user_id"),
        Index("ix_travel_journeys_to_country", "to_country"),
    )


class TonightPost(TimestampMixin, Base):
    __tablename__ = "tonight_posts"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    activity: Mapped[str] = mapped_column(String(40), nullable=False)
    venue: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    tagline: Mapped[str] = mapped_column(String(240), nullable=False, default="")
    looking_for: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    meet_time: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    featured_photo: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_tonight_posts_user_id", "user_id"),
        Index("ix_tonight_posts_activity", "activity"),
        Index("ix_tonight_posts_expires_at", "expires_at"),
    )
