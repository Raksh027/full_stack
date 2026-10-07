import { createApi } from '@reduxjs/toolkit/query/react';

import { CACHE_TTL_SECONDS } from '@/config/constants';
import { env } from '@/config/env';

import { baseQuery as httpBaseQuery } from './baseQuery';
import { mockBaseQuery } from './mock/mockBaseQuery';
import { TAG_TYPES } from './tags';

// Feature APIs attach their endpoints with `baseApi.injectEndpoints` so the
// cache, middleware, and tag invalidation are shared across the whole app.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: env.USE_MOCK_API ? mockBaseQuery : httpBaseQuery,
  tagTypes: TAG_TYPES,
  keepUnusedDataFor: CACHE_TTL_SECONDS.default,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});
