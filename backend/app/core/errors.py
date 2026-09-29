class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class UnauthorizedError(AppError):
    def __init__(
        self,
        message: str = "Authentication required",
        code: str = "UNAUTHORIZED",
        status_code: int = 401,
    ) -> None:
        super().__init__(code, message, status_code)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Not allowed") -> None:
        super().__init__("FORBIDDEN", message, 403)


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__("NOT_FOUND", message, 404)


class ConflictError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, 409)


class RateLimitError(AppError):
    def __init__(self, message: str = "Too many requests") -> None:
        super().__init__("AUTH_RATE_LIMITED", message, 429)


class ProviderTransientError(AppError):
    def __init__(self, message: str = "Store provider temporarily unavailable.") -> None:
        super().__init__("SUBSCRIPTION_PROVIDER_UNAVAILABLE", message, 503)
