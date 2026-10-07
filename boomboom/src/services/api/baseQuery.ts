import {
  fetchBaseQuery,
  retry,
  type BaseQueryApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

import {
  API_MAX_RETRIES,
  API_TIMEOUT_MS,
  API_VERSION,
} from '@/config/constants';
import { env } from '@/config/env';
import { sessionExpired } from '@/features/auth/store/authSlice';
import { tokenManager, type AuthTokens } from '@/services/session/tokenManager';

export const API_BASE_URL = `${env.API_URL}/api/${API_VERSION}`;

function isPublicAuthRequest(args: string | FetchArgs) {
  const url = typeof args === 'string' ? args : args.url;
  return (
    url.startsWith('/auth/google') ||
    url.startsWith('/auth/apple') ||
    url.startsWith('/auth/facebook') ||
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/register') ||
    url.startsWith('/auth/otp') ||
    url.startsWith('/auth/password') ||
    url.startsWith('/auth/email')
  );
}

function withoutAuthHeader(args: string | FetchArgs): FetchArgs {
  const parsed: FetchArgs =
    typeof args === 'string' ? { url: args } : { ...args };
  parsed.headers = {
    'X-Skip-Auth': '1',
  };
  return parsed;
}

type ExtraOptions = Parameters<typeof rawBaseQuery>[2];

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  prepareHeaders: headers => {
    if (headers.get('X-Skip-Auth') === '1') {
      headers.delete('X-Skip-Auth');
      headers.delete('Authorization');
      headers.set('Accept', 'application/json');
      return headers;
    }
    const accessToken = tokenManager.getAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    headers.set('Accept', 'application/json');
    return headers;
  },
});

// Shared across concurrent requests so a burst of 401s triggers a single refresh.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(
  api: BaseQueryApi,
  extraOptions: ExtraOptions,
): Promise<boolean> {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  const accessBefore = tokenManager.getAccessToken();
  const result = await rawBaseQuery(
    { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
    api,
    extraOptions,
  );
  const tokens = unwrapData(result.data);
  if (!tokens) {
    return tokenManager.getAccessToken() !== accessBefore;
  }
  const payload = tokens as AuthTokens & { tokens?: AuthTokens };
  await tokenManager.set(payload.tokens ?? payload);
  return true;
}

function unwrapData(payload: unknown): unknown {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

function toAbsoluteUrl(url: string): string {
  if (!url || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const origin = env.API_URL.replace(/\/$/, '');
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
}

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  if (isPublicAuthRequest(args)) {
    return normalizeResult(
      await rawBaseQuery(withoutAuthHeader(args), api, extraOptions),
    );
  }

  if (refreshInFlight) {
    await refreshInFlight;
  }

  const tokenUsed = tokenManager.getAccessToken();
  let result = await rawBaseQuery(args, api, extraOptions);
  result = normalizeResult(result);

  if (result.error?.status !== 401 || !tokenManager.getRefreshToken()) {
    return result;
  }

  if (tokenManager.getAccessToken() !== tokenUsed) {
    return normalizeResult(await rawBaseQuery(args, api, extraOptions));
  }

  refreshInFlight ??= refreshTokens(api, extraOptions).finally(() => {
    refreshInFlight = null;
  });
  const refreshed = await refreshInFlight;

  if (refreshed) {
    result = normalizeResult(await rawBaseQuery(args, api, extraOptions));
  } else {
    await tokenManager.clear();
    api.dispatch(sessionExpired());
  }

  return result;
};

function normalizeResult<T extends { data?: unknown; error?: FetchBaseQueryError }>(
  result: T,
): T {
  if (result.error && result.error.data) {
    const body = result.error.data as {
      error?: { code?: string; message?: string };
      message?: string;
    };
    if (body?.error?.message) {
      result.error = {
        ...result.error,
        data: {
          detail: {
            message: body.error.message,
            code: body.error.code,
          },
        },
      };
    }
  }
  if (result.data !== undefined) {
    const data = unwrapData(result.data);
    if (
      data &&
      typeof data === 'object' &&
      'uploadUrl' in data &&
      typeof (data as { uploadUrl?: string }).uploadUrl === 'string'
    ) {
      (data as { uploadUrl: string }).uploadUrl = toAbsoluteUrl(
        (data as { uploadUrl: string }).uploadUrl,
      );
    }
    return { ...result, data };
  }
  return result;
}

function isIdempotent(args: string | FetchArgs): boolean {
  const method = typeof args === 'string' ? 'GET' : args.method ?? 'GET';
  return ['GET', 'HEAD', 'PUT', 'DELETE'].includes(method.toUpperCase());
}

export const baseQuery = retry(baseQueryWithReauth, {
  retryCondition: (error, args, { attempt }) => {
    if (attempt > API_MAX_RETRIES || !isIdempotent(args)) {
      return false;
    }
    const { status } = error as FetchBaseQueryError;
    return (
      status === 'FETCH_ERROR' ||
      status === 'TIMEOUT_ERROR' ||
      (typeof status === 'number' && status >= 500)
    );
  },
});
