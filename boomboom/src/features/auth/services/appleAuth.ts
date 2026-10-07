import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';

import { env } from '@/config/env';

import type { AppleSignInRequest } from '../types';

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios' && (env.USE_MOCK_API || appleAuth.isSupported);
}

/** Returns the Apple credential payload, or `null` when the user cancels. */
export async function getAppleCredential(): Promise<AppleSignInRequest | null> {
  if (env.USE_MOCK_API) {
    return { identityToken: 'mock-apple-identity-token', nonce: 'mock-nonce' };
  }
  if (!isAppleSignInAvailable()) {
    throw new Error('Sign in with Apple is not available on this device');
  }
  try {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });

    if (!response.identityToken) {
      throw new Error('Apple did not return an identity token');
    }

    // Simulator and first-run devices often fail this check even when
    // Apple returned a valid identity token.
    try {
      const credentialState = await appleAuth.getCredentialStateForUser(
        response.user,
      );
      if (credentialState === appleAuth.State.REVOKED) {
        throw new Error('Apple credential is revoked');
      }
    } catch (stateError) {
      if (
        stateError instanceof Error &&
        stateError.message === 'Apple credential is revoked'
      ) {
        throw stateError;
      }
    }

    return {
      identityToken: response.identityToken,
      nonce: response.nonce ?? '',
      // Apple only returns the name on the very first authorization.
      fullName: response.fullName
        ? {
            givenName: response.fullName.givenName,
            familyName: response.fullName.familyName,
          }
        : undefined,
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === appleAuth.Error.CANCELED
    ) {
      return null;
    }
    throw error;
  }
}
