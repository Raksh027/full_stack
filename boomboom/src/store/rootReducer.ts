import { combineReducers } from '@reduxjs/toolkit';

import { authReducer } from '@/features/auth/store/authSlice';
import { chatReducer } from '@/features/chat/store/chatSlice';
import { preferencesReducer } from '@/features/settings/store/preferencesSlice';
import { baseApi } from '@/services/api/baseApi';

import { appReducer } from './appSlice';

export const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  app: appReducer,
  auth: authReducer,
  chat: chatReducer,
  preferences: preferencesReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
