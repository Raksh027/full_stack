import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthStatus, SessionUser } from '../types';

type AuthState = {
  status: AuthStatus;
  user: SessionUser | null;
  isSigningOut: boolean;
};

const initialState: AuthState = {
  status: 'restoring',
  user: null,
  isSigningOut: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<SessionUser>) {
      state.status = 'authenticated';
      state.user = action.payload;
      state.isSigningOut = false;
    },
    sessionUserUpdated(state, action: PayloadAction<Partial<SessionUser>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    loggedOut(): AuthState {
      return { status: 'unauthenticated', user: null, isSigningOut: false };
    },
    sessionExpired(): AuthState {
      return { status: 'unauthenticated', user: null, isSigningOut: false };
    },
  },
  selectors: {
    selectAuthStatus: state => state.status,
    selectSessionUser: state => state.user,
    selectIsAuthenticated: state => state.status === 'authenticated',
    selectIsSigningOut: state => state.isSigningOut,
  },
  extraReducers: builder => {
    builder.addMatcher(
      action => action.type === 'auth/restoreSession/rejected',
      state => {
        if (state.status === 'restoring') {
          state.status = 'unauthenticated';
          state.user = null;
          state.isSigningOut = false;
        }
      },
    );
    builder.addMatcher(
      action => action.type === 'auth/signOut/pending',
      state => {
        state.isSigningOut = true;
      },
    );
    builder.addMatcher(
      action =>
        action.type === 'auth/signOut/fulfilled' ||
        action.type === 'auth/signOut/rejected',
      state => {
        state.isSigningOut = false;
      },
    );
  },
});

export const { sessionStarted, sessionUserUpdated, loggedOut, sessionExpired } =
  authSlice.actions;

export const {
  selectAuthStatus,
  selectSessionUser,
  selectIsAuthenticated,
  selectIsSigningOut,
} = authSlice.selectors;

export const authReducer = authSlice.reducer;
