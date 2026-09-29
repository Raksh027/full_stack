from uuid import uuid4

import pytest

from app.core.eligibility import (
    account_can_message,
    parse_user_id,
    require_not_self,
    target_is_visible_for_interaction,
)
from app.core.errors import AppError
from app.core.moderation import MAX_TEXT_LENGTH, moderate_text_message
from app.core.realtime import decode_event, encode_event
from app.models.orm import Profile, ProfileVisibility, User, UserStatus
from app.repositories.interactions import MatchRepository


def test_parse_user_id_rejects_invalid() -> None:
    with pytest.raises(AppError):
        parse_user_id("not-a-uuid")


def test_require_not_self() -> None:
    user_id = uuid4()
    with pytest.raises(AppError):
        require_not_self(user_id, user_id, "like")


def test_canonical_match_order() -> None:
    left, right = uuid4(), uuid4()
    a, b = MatchRepository.canonical_pair(left, right)
    c, d = MatchRepository.canonical_pair(right, left)
    assert (a, b) == (c, d)
    assert a < b


def test_moderate_text_rejects_empty_and_oversized() -> None:
    with pytest.raises(AppError):
        moderate_text_message("   ")
    with pytest.raises(AppError):
        moderate_text_message("x" * (MAX_TEXT_LENGTH + 1))
    assert moderate_text_message("  hello  ") == "hello"


def test_event_envelope_roundtrip() -> None:
    raw = encode_event("MESSAGE_RECEIVED", {"id": "1"})
    parsed = decode_event(raw)
    assert parsed["type"] == "MESSAGE_RECEIVED"
    assert parsed["data"]["id"] == "1"


def test_account_messaging_and_visibility() -> None:
    user = User(status=UserStatus.ACTIVE.value)
    user.profile = Profile(visibility=ProfileVisibility.PUBLIC.value)
    assert account_can_message(user)
    assert target_is_visible_for_interaction(user)
    user.status = UserStatus.BANNED.value
    assert not account_can_message(user)
    user.status = UserStatus.ACTIVE.value
    user.profile.visibility = ProfileVisibility.HIDDEN.value
    assert not target_is_visible_for_interaction(user)
