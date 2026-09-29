import logging
from io import StringIO

from app.config import Settings
from app.core.logging import RequestIdFormatter, configure_logging


def _settings() -> Settings:
    return Settings(jwt_secret="replace-with-a-long-random-local-dev-secret")


def test_formatter_defaults_missing_request_id() -> None:
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(RequestIdFormatter("request_id=%(request_id)s %(message)s"))
    record = logging.LogRecord(
        name="test.logging",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello",
        args=(),
        exc_info=None,
    )
    handler.emit(record)
    line = stream.getvalue()
    assert "request_id=-" in line
    assert "hello" in line


def test_formatter_preserves_existing_request_id() -> None:
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(RequestIdFormatter("request_id=%(request_id)s %(message)s"))
    record = logging.LogRecord(
        name="test.logging",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello",
        args=(),
        exc_info=None,
    )
    record.request_id = "abc-123"
    handler.emit(record)
    line = stream.getvalue()
    assert "request_id=abc-123" in line
    assert "request_id=-" not in line


def test_configure_logging_accepts_records_without_request_id() -> None:
    configure_logging(_settings())
    logging.getLogger("test.logging.configure").info("no extra fields")
