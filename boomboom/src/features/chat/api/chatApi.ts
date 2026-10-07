import { PAGE_SIZE } from '@/config/constants';
import { baseApi } from '@/services/api/baseApi';
import type { CursorPage, CursorPageParam, ID } from '@/shared/types/api';
import {
  cursorInfiniteQueryOptions,
  cursorParams,
} from '@/shared/utils/pagination';

import type {
  ChatMessage,
  Conversation,
  SendMessageRequest,
  StartConversationRequest,
  StartConversationResult,
} from '../types';

import { upsertMessage } from './messageCache';
import { asCursorPage, normalizeConversation, normalizeMessage } from '@/shared/utils/normalizeApi';

function asDataRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export const chatApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getConversations: build.infiniteQuery<
      CursorPage<Conversation>,
      void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/conversations',
        params: cursorParams(pageParam, PAGE_SIZE.conversations),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeConversation),
      providesTags: ['Conversations'],
    }),
    startConversation: build.mutation<
      StartConversationResult,
      StartConversationRequest
    >({
      query: ({ userId, clientId, body }) => ({
        url: '/conversations',
        method: 'POST',
        body: { userId, clientId, body },
      }),
      transformResponse: (response: unknown) => {
        const row = asDataRecord(response);
        const conversation = normalizeConversation(row.conversation);
        const message = normalizeMessage(row.message);
        if (!conversation?.id || !message?.id) {
          throw new Error('Could not start this chat. Try again.');
        }
        return { conversation, message };
      },
      invalidatesTags: ['Conversations', 'Likes'],
      async onQueryStarted(_request, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            chatApi.util.updateQueryData('getConversations', undefined, draft => {
              if (!draft?.pages) {
                return;
              }
              const pages = draft.pages;
              if (!pages.length) {
                pages.push({ items: [data.conversation], nextCursor: null });
                return;
              }
              const first = pages[0];
              if (!first) {
                pages.push({ items: [data.conversation], nextCursor: null });
                return;
              }
              first.items = [
                data.conversation,
                ...(first.items ?? []).filter(
                  item => item.id !== data.conversation.id,
                ),
              ];
            }),
          );
          dispatch(
            chatApi.util.updateQueryData(
              'getMessages',
              data.conversation.id,
              draft => upsertMessage(draft, data.message),
            ),
          );
        } catch {
          // Surfaced to the caller through the mutation result.
        }
      },
    }),
    // Pages are newest-first: page 0 holds the latest messages.
    getMessages: build.infiniteQuery<
      CursorPage<ChatMessage>,
      ID,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ queryArg: conversationId, pageParam }) => ({
        url: `/conversations/${conversationId}/messages`,
        params: cursorParams(pageParam, PAGE_SIZE.messages),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeMessage),
      providesTags: (_result, _error, conversationId) => [
        { type: 'Messages', id: conversationId },
      ],
    }),
    sendMessage: build.mutation<ChatMessage, SendMessageRequest>({
      query: ({ conversationId, clientId, body }) => ({
        url: `/conversations/${conversationId}/messages`,
        method: 'POST',
        body: { clientId, body },
      }),
      async onQueryStarted(request, { dispatch, queryFulfilled }) {
        const pending: ChatMessage = {
          id: request.clientId,
          clientId: request.clientId,
          conversationId: request.conversationId,
          senderId: request.senderId,
          body: request.body,
          createdAt: new Date().toISOString(),
          status: 'sending',
        };
        dispatch(
          chatApi.util.updateQueryData(
            'getMessages',
            request.conversationId,
            draft => upsertMessage(draft, pending),
          ),
        );
        dispatch(
          chatApi.util.updateQueryData('getConversations', undefined, draft => {
            if (!draft?.pages) {
              return;
            }
            for (const page of draft.pages) {
              const conversation = (page.items ?? []).find(
                item => item.id === request.conversationId,
              );
              if (conversation) {
                conversation.lastMessage = pending;
                conversation.updatedAt = pending.createdAt;
                conversation.unreadCount = 0;
              }
            }
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            chatApi.util.updateQueryData(
              'getMessages',
              request.conversationId,
              draft => upsertMessage(draft, data),
            ),
          );
          dispatch(
            chatApi.util.updateQueryData('getConversations', undefined, draft => {
              if (!draft?.pages) {
                return;
              }
              for (const page of draft.pages) {
                const conversation = (page.items ?? []).find(
                  item => item.id === request.conversationId,
                );
                if (conversation) {
                  conversation.lastMessage = data;
                  conversation.updatedAt = data.createdAt;
                }
              }
            }),
          );
        } catch {
          dispatch(
            chatApi.util.updateQueryData(
              'getMessages',
              request.conversationId,
              draft => upsertMessage(draft, { ...pending, status: 'failed' }),
            ),
          );
        }
      },
    }),
    markConversationRead: build.mutation<
      void,
      { conversationId: ID; lastReadMessageId: ID }
    >({
      query: ({ conversationId, lastReadMessageId }) => ({
        url: `/conversations/${conversationId}/read`,
        method: 'POST',
        body: { lastReadMessageId },
      }),
      async onQueryStarted({ conversationId }, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          chatApi.util.updateQueryData('getConversations', undefined, draft => {
            if (!draft?.pages) {
              return;
            }
            for (const page of draft.pages) {
              const conversation = (page.items ?? []).find(
                c => c.id === conversationId,
              );
              if (conversation) {
                conversation.unreadCount = 0;
              }
            }
          }),
        );
        queryFulfilled.catch(optimistic.undo);
      },
    }),
  }),
});

export const {
  useGetConversationsInfiniteQuery,
  useGetMessagesInfiniteQuery,
  useSendMessageMutation,
  useStartConversationMutation,
  useMarkConversationReadMutation,
} = chatApi;
