import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { logger } from '@/services/logger/logger';

import type { GoogleSignInRequest } from '../types';

export function configureGoogleSignIn() {
  if (env.USE_MOCK_API) {
    return;
  }
  if (!env.GOOGLE_WEB_CLIENT_ID) {
    logger.warn('GOOGLE_WEB_CLIENT_ID is not set; Google Sign-In is disabled');
    return;
  }
  // Keep this to email + profile only. Extra Google scopes need app
  // verification and will block testers after the first successful login.
  GoogleSignin.configure({
    webClientId: env.GOOGLE_WEB_CLIENT_ID,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID,
    scopes: ['profile', 'email'],
  });
}

/** Returns the Google credential, or `null` when the user cancels. */
export async function getGoogleIdToken(): Promise<GoogleSignInRequest | null> {
  if (env.USE_MOCK_API) {
    return { idToken: 'mock-google-id-token' };
  }
  if (!env.GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Google Sign-In is not configured');
  }
  configureGoogleSignIn();
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    try {
      await GoogleSignin.signOut();
    } catch {
      // A previous blocked consent can sit on the device; start clean.
    }
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return null;
    }
    if (!response.data.idToken) {
      throw new Error('Google did not return an ID token');
    }
    return {
      idToken: response.data.idToken,
    };
  } catch (error) {
    if (
      isErrorWithCode(error) &&
      (error.code === statusCodes.IN_PROGRESS ||
        error.code === statusCodes.SIGN_IN_CANCELLED)
    ) {
      return null;
    }
    throw error;
  }
}

export async function signOutFromGoogle() {
  if (!env.GOOGLE_WEB_CLIENT_ID || env.USE_MOCK_API) {
    return;
  }
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    logger.warn('Google sign-out failed', { error });
  }
}
