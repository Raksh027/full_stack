import { CACHE_TTL_SECONDS, PAGE_SIZE } from '@/config/constants';
import { matchesApi, prependLikeSent } from '@/features/matches/api/matchesApi';
import { profileApi } from '@/features/profile/api/profileApi';
import { baseApi } from '@/services/api/baseApi';
import type { CursorPage, CursorPageParam } from '@/shared/types/api';
import {
  asCursorPage,
  normalizeCandidate,
  normalizeLikeProfile,
  normalizeMatch,
} from '@/shared/utils/normalizeApi';
import {
  cursorInfiniteQueryOptions,
  cursorParams,
} from '@/shared/utils/pagination';

import type { DiscoveryCandidate, SwipeRequest, SwipeResult } from '../types';

function asDataRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export type DiscoveryFeedArg = {
  segment?: 'everyone' | 'new' | 'active' | 'verified';
};

export type DiscoveryMapArg = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  kind?: 'all' | 'freeTonight' | 'crossedPaths' | 'nearby';
  onlineOnly?: boolean;
};

export const discoveryApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getDiscoveryFeed: build.infiniteQuery<
      CursorPage<DiscoveryCandidate>,
      DiscoveryFeedArg | void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ queryArg, pageParam }) => ({
        url: '/discovery/feed',
        params: {
          ...cursorParams(pageParam, PAGE_SIZE.feed),
          ...(queryArg?.segment ? { segment: queryArg.segment } : {}),
        },
      }),
      transformResponse: (response: unknown): CursorPage<DiscoveryCandidate> =>
        asCursorPage(response, normalizeCandidate),
      providesTags: ['Feed'],
      keepUnusedDataFor: CACHE_TTL_SECONDS.feed,
    }),
    getDiscoveryMap: build.infiniteQuery<
      CursorPage<DiscoveryCandidate>,
      DiscoveryMapArg,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ queryArg, pageParam }) => ({
        url: '/discovery/map',
        params: {
          ...cursorParams(pageParam, PAGE_SIZE.map),
          latitude: queryArg.latitude,
          longitude: queryArg.longitude,
          radiusKm: queryArg.radiusKm,
          ...(queryArg.kind && queryArg.kind !== 'all' ? { kind: queryArg.kind } : {}),
          ...(queryArg.onlineOnly ? { onlineOnly: true } : {}),
        },
      }),
      transformResponse: (response: unknown): CursorPage<DiscoveryCandidate> =>
        asCursorPage(response, normalizeCandidate),
      providesTags: ['Map'],
      keepUnusedDataFor: CACHE_TTL_SECONDS.feed,
    }),
    swipe: build.mutation<SwipeResult, SwipeRequest>({
      query: body => ({ url: '/discovery/swipes', method: 'POST', body }),
      transformResponse: (response: unknown): SwipeResult => {
        const row = asDataRecord(response);
        const match = row.match == null ? null : normalizeMatch(row.match);
        const user = row.user ? normalizeLikeProfile(row.user) : null;
        return {
          match,
          user: user?.id ? user : null,
          likeId: typeof row.likeId === 'string' ? row.likeId : null,
          remainingLikes:
            typeof row.remainingLikes === 'number' ? row.remainingLikes : null,
          remainingSuperlikes:
            typeof row.remainingSuperlikes === 'number'
              ? row.remainingSuperlikes
              : null,
        };
      },
      async onQueryStarted({ targetUserId, action }, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          discoveryApi.util.updateQueryData(
            'getDiscoveryFeed',
            undefined,
            draft => {
              if (!draft?.pages) {
                return;
              }
              for (const page of draft.pages) {
                page.items = (page.items ?? []).filter(
                  item => item.id !== targetUserId,
                );
              }
            },
          ),
        );
        try {
          const { data } = await queryFulfilled;
          if (action === 'like' || action === 'superlike') {
            dispatch(
              profileApi.util.updateQueryData(
                'getProfile',
                targetUserId,
                draft => {
                  if (draft) {
                    draft.liked = true;
                  }
                },
              ),
            );
            if (data.user?.id) {
              dispatch(
                matchesApi.util.updateQueryData(
                  'getLikesSent',
                  undefined,
                  draft => {
                    prependLikeSent(draft, {
                      id: data.likeId || `like-${data.user!.id}`,
                      user: data.user!,
                      likedAt: new Date().toISOString(),
                    });
                  },
                ),
              );
            }
          }
          dispatch(
            baseApi.util.invalidateTags([
              'Feed',
              'Likes',
              'Matches',
              'Conversations',
              'Notifications',
              { type: 'Profile', id: targetUserId },
            ]),
          );
        } catch {
          optimistic.undo();
        }
      },
    }),
    rewindLastSwipe: build.mutation<DiscoveryCandidate, void>({
      query: () => ({ url: '/discovery/swipes/last', method: 'DELETE' }),
      transformResponse: (response: unknown) => {
        const item = normalizeCandidate(response);
        if (item) {
          return item;
        }
        return {
          ...normalizeCandidate({ id: 'unknown', name: '', photos: [] })!,
        };
      },
      invalidatesTags: ['Feed'],
    }),
  }),
});

export const {
  useGetDiscoveryFeedInfiniteQuery,
  useGetDiscoveryMapInfiniteQuery,
  useSwipeMutation,
  useRewindLastSwipeMutation,
} = discoveryApi;
