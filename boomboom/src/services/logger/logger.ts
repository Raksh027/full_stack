type LogContext = Record<string, unknown>;

export type ErrorReporter = {
  captureException: (error: unknown, context?: LogContext) => void;
  captureMessage: (message: string, context?: LogContext) => void;
};

let reporter: ErrorReporter | null = null;

export function setErrorReporter(next: ErrorReporter | null) {
  reporter = next;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (__DEV__) {
      console.debug(`[debug] ${message}`, context ?? '');
    }
  },
  info(message: string, context?: LogContext) {
    if (__DEV__) {
      console.info(`[info] ${message}`, context ?? '');
    }
  },
  warn(message: string, context?: LogContext) {
    if (__DEV__) {
      console.warn(`[warn] ${message}`, context ?? '');
    }
    reporter?.captureMessage(message, context);
  },
  error(message: string, error?: unknown, context?: LogContext) {
    if (__DEV__) {
      console.error(`[error] ${message}`, error, context ?? '');
    }
    reporter?.captureException(error ?? new Error(message), {
      message,
      ...context,
    });
  },
};
