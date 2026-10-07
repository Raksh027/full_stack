import { PAGE_SIZE } from '@/config/constants';
import { baseApi } from '@/services/api/baseApi';
import type { CursorPage, CursorPageParam } from '@/shared/types/api';
import {
  asCursorPage,
  normalizeTonightPerson,
} from '@/shared/utils/normalizeApi';
import {
  cursorInfiniteQueryOptions,
  cursorParams,
} from '@/shared/utils/pagination';

import type { FreeTonightPerson } from '../data/mockFreeTonight';

export type TonightListQuery = {
  activity?: string;
  minKm?: number;
  maxKm?: number;
};

export const tonightApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getTonight: build.infiniteQuery<
      CursorPage<FreeTonightPerson>,
      TonightListQuery | void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ queryArg, pageParam }) => ({
        url: '/tonight',
        params: {
          ...cursorParams(pageParam, PAGE_SIZE.tonight),
          ...(queryArg?.activity && queryArg.activity !== 'all'
            ? { activity: queryArg.activity }
            : {}),
          ...(queryArg?.minKm != null ? { minKm: queryArg.minKm } : {}),
          ...(queryArg?.maxKm != null ? { maxKm: queryArg.maxKm } : {}),
        },
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, value => {
          const item = normalizeTonightPerson(value);
          return item && !item.isOwn ? item : null;
        }),
      providesTags: ['Tonight'],
    }),
    getMyTonight: build.query<FreeTonightPerson | null, void>({
      query: () => '/tonight/me',
      transformResponse: (response: unknown) => {
        const root =
          response && typeof response === 'object'
            ? (response as { item?: unknown })
            : {};
        return normalizeTonightPerson(root.item ?? response);
      },
      providesTags: ['Tonight'],
    }),
    createTonight: build.mutation<
      FreeTonightPerson,
      {
        activity: string;
        venue?: string;
        time?: string;
        tagline?: string;
        lookingFor?: string;
      }
    >({
      query: body => ({ url: '/tonight', method: 'POST', body }),
      transformResponse: (response: unknown) =>
        normalizeTonightPerson(response) ?? {
          id: '',
          name: '',
          age: 0,
          photo: '',
          featuredPhoto: '',
          distanceKm: null,
          timeLeft: '',
          endsIn: '',
          activity: 'dating' as const,
          flag: '',
          flagCode: '',
          heightLabel: '',
          venue: '',
          tagline: '',
          lookingFor: '',
          isOnline: false,
          isVerified: false,
          gender: 'woman' as const,
          viewsLeft: 0,
        },
      invalidatesTags: ['Tonight'],
    }),
    updateTonight: build.mutation<
      FreeTonightPerson,
      {
        activity?: string;
        venue?: string;
        time?: string;
        tagline?: string;
        lookingFor?: string;
      }
    >({
      query: body => ({ url: '/tonight', method: 'PATCH', body }),
      transformResponse: (response: unknown) =>
        normalizeTonightPerson(response) ?? {
          id: '',
          name: '',
          age: 0,
          photo: '',
          featuredPhoto: '',
          distanceKm: null,
          timeLeft: '',
          endsIn: '',
          activity: 'dating' as const,
          flag: '',
          flagCode: '',
          heightLabel: '',
          venue: '',
          tagline: '',
          lookingFor: '',
          isOnline: false,
          isVerified: false,
          gender: 'woman' as const,
          viewsLeft: 0,
        },
      invalidatesTags: ['Tonight'],
    }),
    deleteTonight: build.mutation<void, void>({
      query: () => ({ url: '/tonight', method: 'DELETE' }),
      invalidatesTags: ['Tonight'],
    }),
  }),
});

export const {
  useGetTonightInfiniteQuery,
  useGetMyTonightQuery,
  useCreateTonightMutation,
  useUpdateTonightMutation,
  useDeleteTonightMutation,
} = tonightApi;
