import { createAsyncThunk } from '@reduxjs/toolkit';

import {
  isNetworkError,
  parseApiError,
  type ApiError,
} from '@/services/api/apiError';
import { logger } from '@/services/logger/logger';
import { tokenManager } from '@/services/session/tokenManager';
import { getJSON } from '@/services/storage/storage';
import { StorageKeys } from '@/services/storage/storageKeys';

import { authApi } from '../api/authApi';
import { getAppleCredential } from '../services/appleAuth';
import { getFacebookAccessToken } from '../services/facebookAuth';
import { getGoogleIdToken, signOutFromGoogle } from '../services/googleAuth';
import type { SessionUser, SocialSignInResult } from '../types';

import { loggedOut, sessionStarted } from './authSlice';

export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { dispatch, getState }) => {
    const tokens = await tokenManager.load();
    const cachedUser = getJSON<SessionUser>(StorageKeys.sessionUser);
    const alreadyAuthenticated =
      (getState() as { auth: { status: string } }).auth.status ===
      'authenticated';

    if (!tokens) {
      if (!alreadyAuthenticated) {
        dispatch(loggedOut());
      }
      return;
    }

    const request = dispatch(
      authApi.endpoints.getSession.initiate(undefined, { forceRefetch: true }),
    );
    const result = await request;
    request.unsubscribe();

    if (result.data) {
      dispatch(sessionStarted(result.data));
      return;
    }

    // Offline only: keep the cached user. A 401 means this session was
    // revoked (for example signed in on another device).
    if (cachedUser && isNetworkError(result.error)) {
      dispatch(sessionStarted(cachedUser));
      return;
    }

    if (alreadyAuthenticated) {
      return;
    }

    await tokenManager.clear();
    dispatch(loggedOut());
  },
);

export const signInWithGoogle = createAsyncThunk<
  SocialSignInResult,
  void,
  { rejectValue: ApiError }
>('auth/signInWithGoogle', async (_, { dispatch, rejectWithValue }) => {
  try {
    const credential = await getGoogleIdToken();
    if (!credential) {
      return { cancelled: true };
    }
    await dispatch(
      authApi.endpoints.signInWithGoogleToken.initiate(credential),
    ).unwrap();
    dispatch(authApi.util.invalidateTags(['MyProfile', 'Session']));
    return { cancelled: false };
  } catch (error) {
    return rejectWithValue(parseApiError(error));
  }
});

export const signInWithApple = createAsyncThunk<
  SocialSignInResult,
  void,
  { rejectValue: ApiError }
>('auth/signInWithApple', async (_, { dispatch, rejectWithValue }) => {
  try {
    const credential = await getAppleCredential();
    if (!credential) {
      return { cancelled: true };
    }
    await dispatch(
      authApi.endpoints.signInWithAppleToken.initiate(credential),
    ).unwrap();
    dispatch(authApi.util.invalidateTags(['MyProfile', 'Session']));
    return { cancelled: false };
  } catch (error) {
    return rejectWithValue(parseApiError(error));
  }
});

export const signInWithFacebook = createAsyncThunk<
  SocialSignInResult,
  void,
  { rejectValue: ApiError }
>('auth/signInWithFacebook', async (_, { dispatch, rejectWithValue }) => {
  try {
    const accessToken = await getFacebookAccessToken();
    if (!accessToken) {
      return { cancelled: true };
    }
    await dispatch(
      authApi.endpoints.signInWithFacebookToken.initiate({ accessToken }),
    ).unwrap();
    dispatch(authApi.util.invalidateTags(['MyProfile', 'Session']));
    return { cancelled: false };
  } catch (error) {
    return rejectWithValue(parseApiError(error));
  }
});

export const clearLocalSession = createAsyncThunk(
  'auth/clearLocalSession',
  async (_, { dispatch }) => {
    await Promise.all([tokenManager.clear(), signOutFromGoogle()]);
    dispatch(loggedOut());
  },
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { dispatch }) => {
    const refreshToken = tokenManager.getRefreshToken();
    if (refreshToken) {
      try {
        await dispatch(
          authApi.endpoints.revokeSession.initiate({ refreshToken }),
        ).unwrap();
      } catch (error) {
        logger.warn('Failed to revoke session on server', { error });
      }
    }
    await dispatch(clearLocalSession()).unwrap();
  },
);
