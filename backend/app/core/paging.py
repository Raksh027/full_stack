"""Offset cursors for list endpoints that slice an already-filtered set."""

from __future__ import annotations

from typing import Any, Sequence


def parse_offset_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        return max(0, int(cursor))
    except ValueError:
        return 0


def page_items(
    items: Sequence[Any],
    cursor: str | None,
    limit: int,
    max_limit: int = 50,
) -> dict[str, Any]:
    size = max(1, min(int(limit or 20), max(1, int(max_limit or 50))))
    offset = parse_offset_cursor(cursor)
    chunk = list(items[offset : offset + size])
    next_cursor = str(offset + size) if offset + size < len(items) else None
    return {"items": chunk, "nextCursor": next_cursor}
