import type { MatchUser } from '@/features/matches/types';
import type { ID, ISODateString } from '@/shared/types/api';

export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type ChatMessage = {
  id: ID;
  clientId: string | null;
  conversationId: ID;
  senderId: ID;
  body: string;
  createdAt: ISODateString;
  status: MessageStatus;
};

export type Conversation = {
  id: ID;
  matchId: ID;
  user: MatchUser;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: ISODateString;
  /** Incoming like / first message awaiting accept or decline. */
  isRequest?: boolean;
};

export type SendMessageRequest = {
  conversationId: ID;
  clientId: string;
  senderId: ID;
  body: string;
};

export type StartConversationRequest = {
  userId: ID;
  clientId: string;
  senderId: ID;
  body: string;
};

export type StartConversationResult = {
  conversation: Conversation;
  message: ChatMessage;
};

export type TypingEvent = {
  conversationId: ID;
  userId: ID;
  isTyping: boolean;
};

export type MessagesReadEvent = {
  conversationId: ID;
  readerId: ID;
  lastReadMessageId: ID;
  readAt: ISODateString;
};
