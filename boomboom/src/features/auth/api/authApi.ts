import type { Dispatch } from '@reduxjs/toolkit';

import { baseApi } from '@/services/api/baseApi';
import { tokenManager } from '@/services/session/tokenManager';
import { setJSON } from '@/services/storage/storage';
import { StorageKeys } from '@/services/storage/storageKeys';

import { sessionStarted } from '../store/authSlice';
import type {
  AppleSignInRequest,
  AuthResponse,
  EmailOtpRequest,
  EmailSignInRequest,
  DeleteAccountRequest,
  EmailSignUpRequest,
  FacebookSignInRequest,
  GoogleSignInRequest,
  SessionUser,
  VerifyLoginOtpRequest,
} from '../types';

async function startSessionOnSuccess(
  _arg: unknown,
  {
    dispatch,
    queryFulfilled,
  }: { dispatch: Dispatch; queryFulfilled: Promise<{ data: AuthResponse }> },
) {
  try {
    const { data } = await queryFulfilled;
    await tokenManager.set(data.tokens);
    setJSON(StorageKeys.sessionUser, data.user);
    dispatch(sessionStarted(data.user));
  } catch {
    // Errors are surfaced to the caller through the mutation result.
  }
}

export const authApi = baseApi.injectEndpoints({
  endpoints: build => ({
    signInWithEmail: build.mutation<AuthResponse, EmailSignInRequest>({
      query: body => ({ url: '/auth/login', method: 'POST', body }),
      onQueryStarted: startSessionOnSuccess,
    }),
    requestLoginOtp: build.mutation<void, EmailOtpRequest>({
      query: body => ({ url: '/auth/otp/request', method: 'POST', body }),
    }),
    verifyLoginOtp: build.mutation<AuthResponse, VerifyLoginOtpRequest>({
      query: body => ({ url: '/auth/otp/verify', method: 'POST', body }),
      onQueryStarted: startSessionOnSuccess,
    }),
    signUpWithEmail: build.mutation<AuthResponse, EmailSignUpRequest>({
      query: body => ({ url: '/auth/register', method: 'POST', body }),
      onQueryStarted: startSessionOnSuccess,
    }),
    signInWithGoogleToken: build.mutation<AuthResponse, GoogleSignInRequest>({
      query: body => ({ url: '/auth/google', method: 'POST', body }),
      onQueryStarted: startSessionOnSuccess,
    }),
    signInWithAppleToken: build.mutation<AuthResponse, AppleSignInRequest>({
      query: body => ({ url: '/auth/apple', method: 'POST', body }),
      onQueryStarted: startSessionOnSuccess,
    }),
    signInWithFacebookToken: build.mutation<AuthResponse, FacebookSignInRequest>({
      query: body => ({ url: '/auth/facebook', method: 'POST', body }),
      onQueryStarted: startSessionOnSuccess,
    }),
    requestPasswordReset: build.mutation<void, { email: string }>({
      query: body => ({ url: '/auth/password/forgot', method: 'POST', body }),
    }),
    verifyEmail: build.mutation<SessionUser, { email: string; code: string }>({
      query: body => ({ url: '/auth/email/verify', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(data));
        } catch {
          // Surfaced to the caller through the mutation result.
        }
      },
    }),
    resendVerificationEmail: build.mutation<void, { email: string }>({
      query: body => ({
        url: '/auth/email/verify/resend',
        method: 'POST',
        body,
      }),
    }),
    getSession: build.query<SessionUser, void>({
      query: () => '/auth/me',
      providesTags: ['Session'],
    }),
    revokeSession: build.mutation<void, { refreshToken: string }>({
      query: body => ({ url: '/auth/logout', method: 'POST', body }),
    }),
    deleteAccount: build.mutation<{ deleted: boolean; permanent: boolean }, DeleteAccountRequest>({
      query: body => ({ url: '/users/me', method: 'DELETE', body }),
    }),
  }),
});

export const {
  useSignInWithEmailMutation,
  useSignUpWithEmailMutation,
  useRequestLoginOtpMutation,
  useVerifyLoginOtpMutation,
  useRequestPasswordResetMutation,
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
  useGetSessionQuery,
  useDeleteAccountMutation,
} = authApi;
