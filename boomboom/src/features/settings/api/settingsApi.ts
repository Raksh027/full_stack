import { baseApi } from '@/services/api/baseApi';

import type { DiscoveryPreferences, NotificationSettings } from '../types';
import {
  normalizeDiscoveryPreferences,
  normalizeNotificationSettings,
} from '@/shared/utils/normalizeApi';

export const settingsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getDiscoveryPreferences: build.query<DiscoveryPreferences, void>({
      query: () => '/users/me/discovery-preferences',
      transformResponse: (response: unknown) =>
        normalizeDiscoveryPreferences(response),
      providesTags: ['DiscoveryPreferences'],
    }),
    updateDiscoveryPreferences: build.mutation<
      DiscoveryPreferences,
      Partial<DiscoveryPreferences>
    >({
      query: body => ({
        url: '/users/me/discovery-preferences',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['DiscoveryPreferences', 'Feed'],
      transformResponse: (response: unknown) =>
        normalizeDiscoveryPreferences(response),
    }),
    getNotificationSettings: build.query<NotificationSettings, void>({
      query: () => '/users/me/notification-settings',
      transformResponse: (response: unknown) =>
        normalizeNotificationSettings(response),
      providesTags: ['NotificationSettings'],
    }),
    updateNotificationSettings: build.mutation<
      NotificationSettings,
      Partial<NotificationSettings>
    >({
      query: body => ({
        url: '/users/me/notification-settings',
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: unknown) =>
        normalizeNotificationSettings(response),
      invalidatesTags: ['NotificationSettings', 'Notifications'],
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          settingsApi.util.updateQueryData(
            'getNotificationSettings',
            undefined,
            draft => {
              Object.assign(draft, patch);
            },
          ),
        );
        queryFulfilled.catch(optimistic.undo);
      },
    }),
    startVerification: build.mutation<{ status?: string }, void>({
      query: () => ({
        url: '/verification/start',
        method: 'POST',
        body: { verificationType: 'SELFIE_VERIFICATION' },
      }),
    }),
    requestVerificationUpload: build.mutation<
      {
        uploadUrl: string;
        storageKey: string;
        headers?: Record<string, string>;
      },
      { contentType: string; filename: string; byteSize: number }
    >({
      query: body => ({
        url: '/verification/upload-url',
        method: 'POST',
        body,
      }),
    }),
    submitVerification: build.mutation<void, { storageKey: string }>({
      query: body => ({
        url: '/verification/submit',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Session', 'MyProfile'],
    }),
  }),
});

export const {
  useGetDiscoveryPreferencesQuery,
  useUpdateDiscoveryPreferencesMutation,
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  useStartVerificationMutation,
  useRequestVerificationUploadMutation,
  useSubmitVerificationMutation,
} = settingsApi;
