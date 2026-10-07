import type { InboxNotification } from '@/features/notifications/api/notificationsApi';
import type {
  ChatMessage,
  MessagesReadEvent,
  TypingEvent,
} from '@/features/chat/types';
import type { Match } from '@/features/matches/types';
import type { ID } from '@/shared/types/api';

export type ServerEvents = {
  'message.new': ChatMessage;
  'message.read': MessagesReadEvent;
  typing: TypingEvent;
  'match.new': Match;
  'like.received': { likeId: ID };
  'profile.view': { userId?: ID };
  'travel.update': { userId?: ID };
  'event.update': { userId?: ID };
  'notification.new': InboxNotification;
  'verification.update': { userId?: ID };
  'subscription.update': { userId?: ID };
  'safety.alert': { userId?: ID };
  presence: { userId: ID; isOnline: boolean };
};

export type ClientEvents = {
  typing: { conversationId: ID; isTyping: boolean };
  'presence.subscribe': { userIds: ID[] };
};
