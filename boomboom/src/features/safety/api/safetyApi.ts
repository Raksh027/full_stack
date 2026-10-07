import { PAGE_SIZE } from '@/config/constants';
import { baseApi } from '@/services/api/baseApi';
import type { CursorPage, CursorPageParam, ID } from '@/shared/types/api';
import { asCursorPage, normalizeBlockedUser } from '@/shared/utils/normalizeApi';
import {
  cursorInfiniteQueryOptions,
  cursorParams,
} from '@/shared/utils/pagination';

export type ReportReason =
  | 'fake_profile'
  | 'inappropriate_content'
  | 'harassment'
  | 'spam'
  | 'underage'
  | 'other';

export type ReportUserRequest = {
  userId: ID;
  reason: ReportReason;
  details?: string;
};

export type BlockedUser = {
  id: ID;
  name: string;
  age?: number;
  photos?: { id: string; url: string; position: number }[];
  isVerified?: boolean;
};

export const safetyApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getBlockedUsers: build.infiniteQuery<
      CursorPage<BlockedUser>,
      void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/safety/blocks',
        params: cursorParams(pageParam, PAGE_SIZE.blocks),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeBlockedUser),
      providesTags: ['Blocks'],
    }),
    blockUser: build.mutation<void, ID>({
      query: userId => ({
        url: '/safety/blocks',
        method: 'POST',
        body: { userId },
      }),
      invalidatesTags: ['Blocks', 'Matches', 'Conversations', 'Feed'],
    }),
    unblockUser: build.mutation<void, ID>({
      query: userId => ({ url: `/safety/blocks/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Blocks'],
    }),
    reportUser: build.mutation<void, ReportUserRequest>({
      query: body => ({ url: '/safety/reports', method: 'POST', body }),
      invalidatesTags: ['Matches', 'Conversations', 'Feed'],
    }),
  }),
});

export const {
  useGetBlockedUsersInfiniteQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useReportUserMutation,
} = safetyApi;
