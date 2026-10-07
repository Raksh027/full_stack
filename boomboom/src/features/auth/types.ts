import type { AuthTokens } from '@/services/session/tokenManager';
import type { ID } from '@/shared/types/api';

export type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

export type AuthProvider = 'email' | 'google' | 'apple' | 'facebook';

export type SessionUser = {
  id: ID;
  email: string | null;
  provider: AuthProvider;
  isOnboarded: boolean;
  isPremium: boolean;
  isEmailVerified: boolean;
};

export type AuthResponse = {
  tokens: AuthTokens;
  user: SessionUser;
  isNewUser: boolean;
};

export type EmailSignInRequest = {
  email: string;
  password: string;
};

export type EmailSignUpRequest = {
  email: string;
  password: string;
};

export type EmailOtpRequest = {
  email: string;
};

export type VerifyLoginOtpRequest = {
  email: string;
  code: string;
};

export type SocialProfileHints = {
  birthDate?: string;
  gender?: string;
};

export type GoogleSignInRequest = {
  idToken: string;
  accessToken?: string;
} & SocialProfileHints;

export type AppleSignInRequest = {
  identityToken: string;
  nonce: string;
  fullName?: {
    givenName: string | null;
    familyName: string | null;
  };
};

export type FacebookSignInRequest = {
  accessToken: string;
} & SocialProfileHints;

export type DeleteAccountRequest = {
  reason: 'noNeed' | 'privacy' | 'alternative' | 'difficult' | 'other';
  details?: string;
};

export type SocialSignInResult = {
  cancelled: boolean;
};
