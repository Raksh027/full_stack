import {
  clearTokens,
  loadTokens,
  saveTokens,
  type AuthTokens,
} from '@/services/storage/secureStorage';

// The keychain is slow to read, so tokens are cached in memory for every request.
let cached: AuthTokens | null = null;

export const tokenManager = {
  getAccessToken: (): string | null => cached?.accessToken ?? null,

  getRefreshToken: (): string | null => cached?.refreshToken ?? null,

  async load(): Promise<AuthTokens | null> {
    cached = await loadTokens();
    return cached;
  },

  async set(tokens: AuthTokens): Promise<void> {
    cached = tokens;
    await saveTokens(tokens);
  },

  async clear(): Promise<void> {
    cached = null;
    await clearTokens();
  },
};

export type { AuthTokens };
