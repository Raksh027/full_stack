import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { loggedOut, sessionExpired } from '@/features/auth/store/authSlice';
import type { ID } from '@/shared/types/api';

import type { TypingEvent } from '../types';

type ChatState = {
  typingUserIdsByConversation: Record<ID, ID[]>;
  onlineUserIds: Record<ID, true>;
};

const initialState: ChatState = {
  typingUserIdsByConversation: {},
  onlineUserIds: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    typingChanged(state, action: PayloadAction<TypingEvent>) {
      const { conversationId, userId, isTyping } = action.payload;
      const current = state.typingUserIdsByConversation[conversationId] ?? [];
      const next = isTyping
        ? Array.from(new Set([...current, userId]))
        : current.filter(id => id !== userId);
      if (next.length) {
        state.typingUserIdsByConversation[conversationId] = next;
      } else {
        delete state.typingUserIdsByConversation[conversationId];
      }
    },
    presenceChanged(
      state,
      action: PayloadAction<{ userId: ID; isOnline: boolean }>,
    ) {
      if (action.payload.isOnline) {
        state.onlineUserIds[action.payload.userId] = true;
      } else {
        delete state.onlineUserIds[action.payload.userId];
      }
    },
  },
  extraReducers: builder => {
    builder.addCase(loggedOut, () => initialState);
    builder.addCase(sessionExpired, () => initialState);
  },
  selectors: {
    selectTypingUserIds: (state, conversationId: ID) =>
      state.typingUserIdsByConversation[conversationId],
    selectIsUserOnline: (state, userId: ID) =>
      Boolean(state.onlineUserIds[userId]),
  },
});

export const { typingChanged, presenceChanged } = chatSlice.actions;
export const { selectTypingUserIds, selectIsUserOnline } = chatSlice.selectors;
export const chatReducer = chatSlice.reducer;
