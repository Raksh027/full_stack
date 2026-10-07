import { PAGE_SIZE } from '@/config/constants';
import { baseApi } from '@/services/api/baseApi';
import type { CursorPage, CursorPageParam, ID } from '@/shared/types/api';
import {
  asCursorPage,
  normalizeLikeReceived,
  normalizeLikeSent,
  normalizeMatch,
  normalizeProfileView,
} from '@/shared/utils/normalizeApi';
import {
  cursorInfiniteQueryOptions,
  cursorParams,
} from '@/shared/utils/pagination';

import type {
  LikeReceived,
  LikeResponseRequest,
  LikeResponseResult,
  LikeSent,
  Match,
  ProfileView,
} from '../types';

type InfiniteLikesDraft = {
  pages?: Array<{ items?: LikeSent[]; nextCursor?: string | null }>;
};

export function prependLikeSent(
  draft: InfiniteLikesDraft | undefined,
  like: LikeSent,
) {
  if (!draft) {
    return;
  }
  if (!draft.pages?.length) {
    draft.pages = [{ items: [like], nextCursor: null }];
    return;
  }
  const first = draft.pages[0];
  first.items = [
    like,
    ...(first.items ?? []).filter(item => item.user.id !== like.user.id),
  ];
}

export const matchesApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getMatches: build.infiniteQuery<CursorPage<Match>, void, CursorPageParam>({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/matches',
        params: cursorParams(pageParam, PAGE_SIZE.matches),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeMatch),
      providesTags: ['Matches'],
    }),
    getLikesReceived: build.infiniteQuery<
      CursorPage<LikeReceived>,
      void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/likes/received',
        params: cursorParams(pageParam, PAGE_SIZE.matches),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeLikeReceived),
      providesTags: ['Likes'],
    }),
    getLikesSent: build.infiniteQuery<
      CursorPage<LikeSent>,
      void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/likes/sent',
        params: cursorParams(pageParam, PAGE_SIZE.matches),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeLikeSent),
      providesTags: ['Likes'],
    }),
    getRecentlyViewed: build.infiniteQuery<
      CursorPage<ProfileView>,
      void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/likes/viewed',
        params: cursorParams(pageParam, PAGE_SIZE.matches),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeProfileView),
      providesTags: ['Likes'],
    }),
    respondToLike: build.mutation<LikeResponseResult, LikeResponseRequest>({
      query: ({ likeId, action }) => ({
        url: `/likes/received/${likeId}/respond`,
        method: 'POST',
        body: { action },
      }),
      invalidatesTags: ['Likes', 'Matches', 'Conversations', 'Feed', 'Notifications'],
    }),
    removeLike: build.mutation<void, ID>({
      query: userId => ({ url: `/likes/sent/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Likes'],
    }),
    recordProfileView: build.mutation<void, ID>({
      query: userId => ({
        url: `/profiles/${userId}/views`,
        method: 'POST',
      }),
      invalidatesTags: ['Likes', 'Notifications'],
    }),
    unmatch: build.mutation<void, ID>({
      query: matchId => ({ url: `/matches/${matchId}`, method: 'DELETE' }),
      invalidatesTags: ['Matches', 'Conversations'],
    }),
  }),
});

export const {
  useGetMatchesInfiniteQuery,
  useGetLikesReceivedInfiniteQuery,
  useGetLikesSentInfiniteQuery,
  useGetRecentlyViewedInfiniteQuery,
  useRespondToLikeMutation,
  useRemoveLikeMutation,
  useRecordProfileViewMutation,
  useUnmatchMutation,
} = matchesApi;
