import { CACHE_TTL_SECONDS } from '@/config/constants';
import { InteractionManager } from 'react-native';

import { sessionUserUpdated } from '@/features/auth/store/authSlice';
import { baseApi } from '@/services/api/baseApi';
import type { ID, Photo } from '@/shared/types/api';

import type { SessionUser } from '@/features/auth/types';
import type {
  MyProfile,
  PhotoUploadTicket,
  Profile,
  ResolvedLocation,
  EmailChangeStatus,
  UpdateLocationRequest,
  UpdateProfileRequest,
} from '../types';
import { normalizeMyProfile, normalizeProfile } from '@/shared/utils/normalizeApi';
import { asArray } from '@/shared/utils/safeValue';

export const profileApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getMyProfile: build.query<MyProfile, void>({
      query: () => '/profiles/me',
      transformResponse: (response: unknown) => normalizeMyProfile(response),
      providesTags: ['MyProfile'],
    }),
    updateMyProfile: build.mutation<MyProfile, UpdateProfileRequest>({
      query: body => ({ url: '/profiles/me', method: 'PATCH', body }),
      transformResponse: (response: unknown) => normalizeMyProfile(response),
      invalidatesTags: [
        'MyProfile',
        'Feed',
        'DiscoveryPreferences',
        'Travel',
        'Tonight',
      ],
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const { lifestyle, ...fields } = patch;
        const optimistic = dispatch(
          profileApi.util.updateQueryData('getMyProfile', undefined, draft => {
            Object.assign(draft, fields);
            if (lifestyle) {
              draft.lifestyle = { ...draft.lifestyle, ...lifestyle };
            }
            draft.photos = asArray(draft.photos) as MyProfile['photos'];
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            profileApi.util.upsertQueryData('getMyProfile', undefined, data),
          );
        } catch {
          optimistic.undo();
        }
      },
    }),
    completeOnboarding: build.mutation<MyProfile, void>({
      query: () => ({
        url: '/profiles/me/onboarding/complete',
        method: 'POST',
      }),
      transformResponse: (response: unknown) => normalizeMyProfile(response),
      invalidatesTags: [
        'MyProfile',
        'Feed',
        'DiscoveryPreferences',
        'Travel',
        'Tonight',
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          InteractionManager.runAfterInteractions(() => {
            dispatch(sessionUserUpdated({ isOnboarded: true }));
          });
        } catch {
          // Surfaced to the caller through the mutation result.
        }
      },
    }),
    getProfile: build.query<Profile, ID>({
      query: userId => `/profiles/${userId}`,
      transformResponse: (response: unknown) => normalizeProfile(response),
      providesTags: (_result, _error, userId) => [
        { type: 'Profile', id: userId },
      ],
      keepUnusedDataFor: CACHE_TTL_SECONDS.profile,
    }),
    requestPhotoUpload: build.mutation<
      PhotoUploadTicket,
      { contentType: string; fileSize: number }
    >({
      query: body => ({
        url: '/profiles/me/photos/upload-url',
        method: 'POST',
        body,
      }),
    }),
    confirmPhotoUpload: build.mutation<Photo, ID>({
      query: photoId => ({
        url: `/profiles/me/photos/${photoId}/confirm`,
        method: 'POST',
      }),
      invalidatesTags: ['MyProfile'],
    }),
    deletePhoto: build.mutation<void, ID>({
      query: photoId => ({
        url: `/profiles/me/photos/${photoId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MyProfile'],
    }),
    reorderPhotos: build.mutation<void, ID[]>({
      query: photoIds => ({
        url: '/profiles/me/photos/order',
        method: 'PUT',
        body: { photoIds },
      }),
      async onQueryStarted(photoIds, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          profileApi.util.updateQueryData('getMyProfile', undefined, draft => {
            const photos = asArray(draft.photos) as MyProfile['photos'];
            const byId = new Map(photos.map(photo => [photo.id, photo]));
            draft.photos = photoIds
              .map((id, position) => {
                const photo = byId.get(id);
                return photo ? { ...photo, position } : undefined;
              })
              .filter((photo): photo is Photo => photo !== undefined);
          }),
        );
        queryFulfilled.catch(optimistic.undo);
      },
    }),
    updateLocation: build.mutation<ResolvedLocation, UpdateLocationRequest>({
      query: body => ({ url: '/profiles/me/location', method: 'PUT', body }),
      invalidatesTags: ['Feed', 'Map', 'Travel', 'Tonight', 'Likes'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            profileApi.util.updateQueryData(
              'getMyProfile',
              undefined,
              draft => {
                draft.locality = data.locality;
                draft.city = data.city;
                draft.district = data.district;
                draft.region = data.region;
                draft.place = data.place;
                draft.country = data.country;
                draft.countryCode = data.countryCode;
                draft.countryFlag = data.countryFlag;
              },
            ),
          );
        } catch {
          // Surfaced to the caller through the mutation result.
        }
      },
    }),
    getEmailChangeStatus: build.query<EmailChangeStatus, void>({
      query: () => '/users/me/email-change',
      providesTags: ['Session'],
    }),
    requestEmailChange: build.mutation<{ otpSent: boolean; email: string }, { email: string }>({
      query: body => ({
        url: '/users/me/email-change/request',
        method: 'POST',
        body,
      }),
    }),
    verifyEmailChange: build.mutation<SessionUser, { email: string; code: string }>({
      query: body => ({
        url: '/users/me/email-change/verify',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Session'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            sessionUserUpdated({
              email: data.email,
              isEmailVerified: Boolean(
                data.isEmailVerified ??
                  (data as SessionUser & { emailVerified?: boolean }).emailVerified,
              ),
            }),
          );
        } catch {
          // Surfaced to the caller through the mutation result.
        }
      },
    }),
  }),
});

export const {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useCompleteOnboardingMutation,
  useGetProfileQuery,
  useRequestPhotoUploadMutation,
  useConfirmPhotoUploadMutation,
  useDeletePhotoMutation,
  useReorderPhotosMutation,
  useUpdateLocationMutation,
  useGetEmailChangeStatusQuery,
  useRequestEmailChangeMutation,
  useVerifyEmailChangeMutation,
} = profileApi;
