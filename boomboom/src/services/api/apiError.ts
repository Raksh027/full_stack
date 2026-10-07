import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';

export type ApiError = {
  status: number | 'NETWORK' | 'TIMEOUT' | 'PARSING' | 'UNKNOWN';
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

type FastApiValidationItem = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

type FastApiErrorBody = {
  detail?:
    | string
    | FastApiValidationItem[]
    | { message?: string; code?: string };
};

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error &&
    !('data' in error) &&
    !('error' in error)
  );
}

export function isFetchBaseQueryError(
  error: unknown,
): error is FetchBaseQueryError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    !isApiError(error)
  );
}

export function isNetworkError(error: unknown): boolean {
  return (
    isFetchBaseQueryError(error) &&
    (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR')
  );
}

function fromFastApiBody(status: number, body: unknown): ApiError {
  const detail = (body as FastApiErrorBody | undefined)?.detail;

  if (typeof detail === 'string') {
    return { status, message: detail };
  }

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail) {
      const field = item.loc.filter(part => part !== 'body').join('.');
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = item.msg;
      }
    }
    return {
      status,
      message: detail[0]?.msg ?? 'Validation failed',
      fieldErrors,
    };
  }

  if (detail && typeof detail === 'object') {
    return {
      status,
      message: detail.message ?? 'Request failed',
      code: detail.code,
    };
  }

  return { status, message: 'Request failed' };
}

export function parseApiError(
  error: FetchBaseQueryError | SerializedError | unknown,
): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (isFetchBaseQueryError(error)) {
    switch (error.status) {
      case 'FETCH_ERROR':
        return { status: 'NETWORK', message: 'No internet connection' };
      case 'TIMEOUT_ERROR':
        return { status: 'TIMEOUT', message: 'The request timed out' };
      case 'PARSING_ERROR':
        return { status: 'PARSING', message: 'Unexpected server response' };
      case 'CUSTOM_ERROR':
        return { status: 'UNKNOWN', message: error.error };
      default:
        return fromFastApiBody(error.status, error.data);
    }
  }

  if (error instanceof Error) {
    return { status: 'UNKNOWN', message: error.message };
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return { status: 'UNKNOWN', message: String(error.message) };
  }

  return { status: 'UNKNOWN', message: 'Something went wrong' };
}
