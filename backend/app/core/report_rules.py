from app.core.errors import AppError
from app.models.orm import ReportReason, ReportSeverity, ReportStatus

REPORT_REASONS = frozenset(item.value for item in ReportReason)
REPORT_STATUSES = frozenset(item.value for item in ReportStatus)
REPORT_SEVERITIES = frozenset(item.value for item in ReportSeverity)

REASON_LABELS = {
    ReportReason.HARASSMENT.value: "Harassment or abuse",
    ReportReason.SPAM.value: "Spam or advertising",
    ReportReason.SCAM.value: "Fake profile / scam",
    ReportReason.IMPERSONATION.value: "Impersonation",
    ReportReason.INAPPROPRIATE_CONTENT.value: "Inappropriate photos",
    ReportReason.MINOR_SAFETY_CONCERN.value: "Underage user",
    ReportReason.FRAUD.value: "Fraud",
    ReportReason.ABUSIVE_BEHAVIOR.value: "Abusive behavior",
    ReportReason.OTHER.value: "Other",
}

LABEL_TO_REASON = {label.lower(): code for code, label in REASON_LABELS.items()}
LABEL_TO_REASON.update(
    {
        "inappropriate photos": ReportReason.INAPPROPRIATE_CONTENT.value,
        "fake profile / scam": ReportReason.SCAM.value,
        "harassment or abuse": ReportReason.HARASSMENT.value,
        "underage user": ReportReason.MINOR_SAFETY_CONCERN.value,
        "spam or advertising": ReportReason.SPAM.value,
        "other": ReportReason.OTHER.value,
    }
)

SEVERITY_FOR_REASON = {
    ReportReason.MINOR_SAFETY_CONCERN.value: ReportSeverity.CRITICAL.value,
    ReportReason.SCAM.value: ReportSeverity.HIGH.value,
    ReportReason.FRAUD.value: ReportSeverity.HIGH.value,
    ReportReason.HARASSMENT.value: ReportSeverity.HIGH.value,
    ReportReason.ABUSIVE_BEHAVIOR.value: ReportSeverity.HIGH.value,
    ReportReason.IMPERSONATION.value: ReportSeverity.MEDIUM.value,
    ReportReason.INAPPROPRIATE_CONTENT.value: ReportSeverity.MEDIUM.value,
    ReportReason.SPAM.value: ReportSeverity.LOW.value,
    ReportReason.OTHER.value: ReportSeverity.MEDIUM.value,
}


def parse_reason_code(raw: str | None) -> str:
    value = (raw or "").strip()
    upper = value.upper().replace(" ", "_")
    if upper in REPORT_REASONS:
        return upper
    mapped = LABEL_TO_REASON.get(value.lower())
    if mapped:
        return mapped
    raise AppError("VALIDATION_ERROR", "Invalid report reason.", 422)


def parse_severity(raw: str | None) -> str | None:
    if raw is None or not raw.strip():
        return None
    value = raw.strip().upper()
    if value not in REPORT_SEVERITIES:
        raise AppError("VALIDATION_ERROR", "Invalid severity.", 422)
    return value


def public_reason_label(code: str) -> str:
    return REASON_LABELS.get(code, REASON_LABELS[ReportReason.OTHER.value])
