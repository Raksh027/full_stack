import type { AppDispatch } from '@/store';
import { baseApi } from '@/services/api/baseApi';
import { realtime } from '@/services/realtime/realtime';

import { chatApi } from '../api/chatApi';
import { upsertMessage } from '../api/messageCache';
import { presenceChanged, typingChanged } from '../store/chatSlice';

export function registerChatRealtime(dispatch: AppDispatch): () => void {
  const unsubscribers = [
    realtime.on('message.new', message => {
      dispatch(
        chatApi.util.updateQueryData(
          'getMessages',
          message.conversationId,
          draft => upsertMessage(draft, message),
        ),
      );
      dispatch(
        typingChanged({
          conversationId: message.conversationId,
          userId: message.senderId,
          isTyping: false,
        }),
      );
      dispatch(
        chatApi.util.updateQueryData('getConversations', undefined, draft => {
          if (!draft?.pages) {
            return;
          }
          for (const page of draft.pages) {
            const conversation = (page.items ?? []).find(
              c => c.id === message.conversationId,
            );
            if (conversation) {
              conversation.lastMessage = message;
              conversation.updatedAt = message.createdAt;
              if (message.senderId === conversation.user.id) {
                conversation.unreadCount += 1;
              }
              return;
            }
          }
        }),
      );
    }),

    realtime.on('message.read', event => {
      dispatch(
        chatApi.util.updateQueryData(
          'getMessages',
          event.conversationId,
          draft => {
            if (!draft?.pages) {
              return;
            }
            for (const page of draft.pages) {
              for (const item of page.items ?? []) {
                if (
                  item.senderId !== event.readerId &&
                  item.status !== 'failed'
                ) {
                  item.status = 'read';
                }
              }
            }
          },
        ),
      );
    }),

    realtime.on('typing', event => dispatch(typingChanged(event))),

    realtime.on('presence', event => dispatch(presenceChanged(event))),

    realtime.on('match.new', () => {
      dispatch(
        baseApi.util.invalidateTags(['Matches', 'Conversations', 'Notifications']),
      );
    }),

    realtime.on('like.received', () => {
      dispatch(baseApi.util.invalidateTags(['Likes', 'Notifications']));
    }),

    realtime.on('profile.view', () => {
      dispatch(baseApi.util.invalidateTags(['Notifications', 'Likes']));
    }),

    realtime.on('travel.update', () => {
      dispatch(baseApi.util.invalidateTags(['Notifications']));
    }),

    realtime.on('event.update', () => {
      dispatch(baseApi.util.invalidateTags(['Notifications']));
    }),

    realtime.on('notification.new', () => {
      dispatch(baseApi.util.invalidateTags(['Notifications']));
    }),

    realtime.on('verification.update', () => {
      dispatch(baseApi.util.invalidateTags(['Notifications', 'Session']));
    }),

    realtime.on('subscription.update', () => {
      dispatch(baseApi.util.invalidateTags(['Notifications']));
    }),

    realtime.on('safety.alert', () => {
      dispatch(baseApi.util.invalidateTags(['Notifications']));
    }),
  ];

  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
}
