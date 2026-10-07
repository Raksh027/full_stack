import { PAGE_SIZE } from '@/config/constants';
import { baseApi } from '@/services/api/baseApi';
import type { CursorPage, CursorPageParam } from '@/shared/types/api';
import { asCursorPage, normalizeNotification } from '@/shared/utils/normalizeApi';
import { asNumber, asRecord } from '@/shared/utils/safeValue';
import {
  cursorInfiniteQueryOptions,
  cursorParams,
} from '@/shared/utils/pagination';

export type DevicePlatform = 'ios' | 'android';

export type RegisterDeviceRequest = {
  pushToken: string;
  platform: DevicePlatform;
  appVersion: string;
  locale: string;
  deviceId?: string;
};

export type RegisteredDevice = {
  id: string;
};

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  isRead: boolean;
  createdAt: string | null;
  time?: string;
};

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getNotifications: build.infiniteQuery<
      CursorPage<InboxNotification>,
      void,
      CursorPageParam
    >({
      infiniteQueryOptions: cursorInfiniteQueryOptions,
      query: ({ pageParam }) => ({
        url: '/notifications',
        params: cursorParams(pageParam, PAGE_SIZE.notifications),
      }),
      transformResponse: (response: unknown) =>
        asCursorPage(response, normalizeNotification),
      providesTags: ['Notifications'],
    }),
    getUnreadNotificationCount: build.query<number, void>({
      query: () => '/notifications/unread-count',
      transformResponse: (response: unknown) =>
        asNumber(asRecord(response).count, 0),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: build.mutation<void, string>({
      query: id => ({ url: `/notifications/${id}/read`, method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: build.mutation<void, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),
    registerDevice: build.mutation<RegisteredDevice, RegisterDeviceRequest>({
      query: body => ({ url: '/notifications/devices', method: 'POST', body }),
    }),
    unregisterDevice: build.mutation<void, { deviceId: string }>({
      query: ({ deviceId }) => ({
        url: `/notifications/devices/${deviceId}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useGetNotificationsInfiniteQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useRegisterDeviceMutation,
  useUnregisterDeviceMutation,
} = notificationsApi;
