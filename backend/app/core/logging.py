import logging
import sys

from app.config import Settings

_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s"


class RequestIdFormatter(logging.Formatter):
    """Formatter that never crashes when request_id is missing."""

    def format(self, record: logging.LogRecord) -> str:
        if not getattr(record, "request_id", None):
            record.request_id = "-"
        return super().format(record)


class RequestIdFilter(logging.Filter):
    def __init__(self, request_id: str = "-") -> None:
        super().__init__()
        self.request_id = request_id

    def filter(self, record: logging.LogRecord) -> bool:
        if not getattr(record, "request_id", None):
            record.request_id = self.request_id
        return True


def configure_logging(settings: Settings) -> None:
    formatter = RequestIdFormatter(_LOG_FORMAT)
    request_id_filter = RequestIdFilter()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format=_LOG_FORMAT,
        stream=sys.stdout,
        force=True,
    )
    root = logging.getLogger()
    root.addFilter(request_id_filter)
    for handler in root.handlers:
        handler.setFormatter(formatter)
        handler.addFilter(request_id_filter)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
