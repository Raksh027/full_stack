const now = Date.now();

function minutesAgo(mins: number) {
  return new Date(now - mins * 60_000).toISOString();
}

function photo(url: string) {
  return { id: url, url, position: 0 };
}

type MockMessage = {
  id: string;
  clientId: string | null;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
};

type MockConversation = {
  id: string;
  matchId: string;
  user: {
    id: string;
    name: string;
    age: number;
    isVerified: boolean;
    photos: { id: string; url: string; position: number }[];
  };
  lastMessage: MockMessage | null;
  unreadCount: number;
  updatedAt: string;
  isRequest?: boolean;
};

export const MOCK_ONLINE_USER_IDS = new Set(['u-amara', 'u-jewel', 'u-kofi']);

const INITIAL_CONVERSATIONS: MockConversation[] = [
  {
    id: 'c-amara',
    matchId: 'm-amara',
    user: {
      id: 'u-amara',
      name: 'Amara',
      age: 24,
      isVerified: true,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: {
      id: 'msg-amara-2',
      clientId: null,
      conversationId: 'c-amara',
      senderId: 'u-amara',
      body: 'That cafe near CP is still my favorite ☕',
      createdAt: minutesAgo(4),
      status: 'delivered',
    },
    unreadCount: 2,
    updatedAt: minutesAgo(4),
  },
  {
    id: 'c-jewel',
    matchId: 'm-jewel',
    user: {
      id: 'u-jewel',
      name: 'Jewel Speed',
      age: 20,
      isVerified: true,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: {
      id: 'msg-jewel-1',
      clientId: null,
      conversationId: 'c-jewel',
      senderId: 'me',
      body: 'Your photos are stunning, honestly',
      createdAt: minutesAgo(38),
      status: 'read',
    },
    unreadCount: 0,
    updatedAt: minutesAgo(38),
  },
  {
    id: 'c-kofi',
    matchId: 'm-kofi',
    user: {
      id: 'u-kofi',
      name: 'Kofi',
      age: 29,
      isVerified: false,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: {
      id: 'msg-kofi-1',
      clientId: null,
      conversationId: 'c-kofi',
      senderId: 'u-kofi',
      body: 'Free this weekend for a walk?',
      createdAt: minutesAgo(95),
      status: 'delivered',
    },
    unreadCount: 1,
    updatedAt: minutesAgo(95),
  },
  {
    id: 'c-darling',
    matchId: 'm-darling',
    user: {
      id: 'u-darling',
      name: 'Darling',
      age: 28,
      isVerified: true,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: {
      id: 'msg-darling-1',
      clientId: null,
      conversationId: 'c-darling',
      senderId: 'me',
      body: 'Hey! Loved your travel photos',
      createdAt: minutesAgo(260),
      status: 'delivered',
    },
    unreadCount: 0,
    updatedAt: minutesAgo(260),
  },
  {
    id: 'c-maya',
    matchId: 'm-maya',
    user: {
      id: 'u-maya',
      name: 'Maya',
      age: 26,
      isVerified: true,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: {
      id: 'msg-maya-1',
      clientId: null,
      conversationId: 'c-maya',
      senderId: 'u-maya',
      body: 'Did you ever try that rooftop place?',
      createdAt: minutesAgo(1400),
      status: 'delivered',
    },
    unreadCount: 0,
    updatedAt: minutesAgo(1400),
  },
  {
    id: 'c-zuhura',
    matchId: 'm-zuhura',
    user: {
      id: 'u-zuhura',
      name: 'Zuhura',
      age: 32,
      isVerified: true,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: null,
    unreadCount: 0,
    updatedAt: minutesAgo(18),
  },
  {
    id: 'c-james',
    matchId: 'm-james',
    user: {
      id: 'u-james',
      name: 'James',
      age: 31,
      isVerified: false,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: null,
    unreadCount: 0,
    updatedAt: minutesAgo(50),
  },
  {
    id: 'c-lena',
    matchId: 'm-lena',
    user: {
      id: 'u-lena',
      name: 'Lena',
      age: 23,
      isVerified: false,
      photos: [
        photo(
          'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80',
        ),
      ],
    },
    lastMessage: null,
    unreadCount: 0,
    updatedAt: minutesAgo(80),
  },
];

const INITIAL_MESSAGES: Record<string, MockMessage[]> = {
  'c-amara': [
    {
      id: 'msg-amara-2',
      clientId: null,
      conversationId: 'c-amara',
      senderId: 'u-amara',
      body: 'That cafe near CP is still my favorite ☕',
      createdAt: minutesAgo(4),
      status: 'delivered',
    },
    {
      id: 'msg-amara-1',
      clientId: null,
      conversationId: 'c-amara',
      senderId: 'me',
      body: 'We should grab coffee this week',
      createdAt: minutesAgo(12),
      status: 'read',
    },
    {
      id: 'msg-amara-0',
      clientId: null,
      conversationId: 'c-amara',
      senderId: 'u-amara',
      body: 'Hey! Your profile made me smile',
      createdAt: minutesAgo(40),
      status: 'read',
    },
  ],
  'c-jewel': [
    {
      id: 'msg-jewel-1',
      clientId: null,
      conversationId: 'c-jewel',
      senderId: 'me',
      body: 'Your photos are stunning, honestly',
      createdAt: minutesAgo(38),
      status: 'read',
    },
  ],
  'c-kofi': [
    {
      id: 'msg-kofi-1',
      clientId: null,
      conversationId: 'c-kofi',
      senderId: 'u-kofi',
      body: 'Free this weekend for a walk?',
      createdAt: minutesAgo(95),
      status: 'delivered',
    },
  ],
  'c-darling': [
    {
      id: 'msg-darling-1',
      clientId: null,
      conversationId: 'c-darling',
      senderId: 'me',
      body: 'Hey! Loved your travel photos',
      createdAt: minutesAgo(260),
      status: 'delivered',
    },
  ],
  'c-maya': [
    {
      id: 'msg-maya-1',
      clientId: null,
      conversationId: 'c-maya',
      senderId: 'u-maya',
      body: 'Did you ever try that rooftop place?',
      createdAt: minutesAgo(1400),
      status: 'delivered',
    },
    {
      id: 'msg-maya-0',
      clientId: null,
      conversationId: 'c-maya',
      senderId: 'me',
      body: 'Your playlist recs were spot on',
      createdAt: minutesAgo(1460),
      status: 'read',
    },
  ],
  'c-zuhura': [],
  'c-james': [],
  'c-lena': [],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let conversations = clone(INITIAL_CONVERSATIONS);
let messagesByConversation = clone(INITIAL_MESSAGES);

function withSender(message: MockMessage, userId: string): MockMessage {
  return message.senderId === 'me' ? { ...message, senderId: userId } : message;
}

export function listMockConversations(userId: string): MockConversation[] {
  return conversations
    .map(conversation => {
      const msgs = messagesByConversation[conversation.id] ?? [];
      const iSent = msgs.some(message => message.senderId === 'me');
      const theySent = msgs.some(message => message.senderId !== 'me');
      return {
        ...conversation,
        isRequest: theySent && !iSent,
        lastMessage: conversation.lastMessage
          ? withSender(conversation.lastMessage, userId)
          : null,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
}

export function listMockMessages(
  conversationId: string,
  userId: string,
): MockMessage[] {
  return (messagesByConversation[conversationId] ?? []).map(message =>
    withSender(message, userId),
  );
}

export function sendMockMessage(
  conversationId: string,
  userId: string,
  clientId: string,
  body: string,
): MockMessage {
  const createdAt = new Date().toISOString();
  const message: MockMessage = {
    id: `msg-${Date.now()}`,
    clientId,
    conversationId,
    senderId: userId,
    body,
    createdAt,
    status: 'sent',
  };
  const existing = messagesByConversation[conversationId] ?? [];
  messagesByConversation[conversationId] = [message, ...existing];

  const conversation = conversations.find(item => item.id === conversationId);
  if (conversation) {
    conversation.lastMessage = message;
    conversation.updatedAt = createdAt;
    conversation.unreadCount = 0;
  }

  return message;
}

export function markMockConversationRead(conversationId: string) {
  const conversation = conversations.find(item => item.id === conversationId);
  if (conversation) {
    conversation.unreadCount = 0;
  }
}

export function findMockConversationByUser(userId: string) {
  return conversations.find(item => item.user.id === userId) ?? null;
}

export function ensureMockConversation(input: {
  userId: string;
  name: string;
  age: number;
  isVerified: boolean;
  photoUrl?: string;
}): MockConversation {
  const existing = findMockConversationByUser(input.userId);
  if (existing) {
    return existing;
  }

  const id = `c-${input.userId}`;
  const conversation: MockConversation = {
    id,
    matchId: `m-${input.userId}`,
    user: {
      id: input.userId,
      name: input.name,
      age: input.age,
      isVerified: input.isVerified,
      photos: input.photoUrl ? [photo(input.photoUrl)] : [],
    },
    lastMessage: null,
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  };
  conversations.unshift(conversation);
  messagesByConversation[id] = [];
  return conversation;
}
