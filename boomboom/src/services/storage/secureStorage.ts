import * as Keychain from 'react-native-keychain';

import { logger } from '@/services/logger/logger';

import { getJSON, removeItem, setJSON } from './storage';
import { StorageKeys } from './storageKeys';

const TOKEN_SERVICE = 'com.boomboom.auth.tokens';

const KEYCHAIN_OPTIONS = {
  service: TOKEN_SERVICE,
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

function isTokenPair(value: unknown): value is AuthTokens {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AuthTokens).accessToken === 'string' &&
    typeof (value as AuthTokens).refreshToken === 'string'
  );
}

function readBackupTokens(): AuthTokens | null {
  const backup = getJSON<AuthTokens>(StorageKeys.authTokens);
  return isTokenPair(backup) ? backup : null;
}

/** Keychain can return `false` without throwing; MMKV keeps a local copy. */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  setJSON(StorageKeys.authTokens, tokens);
  try {
    const saved = await Keychain.setGenericPassword(
      'tokens',
      JSON.stringify(tokens),
      KEYCHAIN_OPTIONS,
    );
    if (!saved) {
      logger.warn('Keychain did not persist auth tokens; using local backup');
    }
  } catch (error) {
    logger.warn('Keychain save failed; using local backup', { error });
  }
}

export async function loadTokens(): Promise<AuthTokens | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TOKEN_SERVICE,
    });
    if (credentials) {
      const parsed: unknown = JSON.parse(credentials.password);
      if (isTokenPair(parsed)) {
        setJSON(StorageKeys.authTokens, parsed);
        return parsed;
      }
    }
  } catch (error) {
    logger.warn('Keychain load failed; trying local backup', { error });
  }

  return readBackupTokens();
}

export async function clearTokens(): Promise<void> {
  removeItem(StorageKeys.authTokens);
  try {
    await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
  } catch (error) {
    logger.warn('Keychain clear failed', { error });
  }
}
