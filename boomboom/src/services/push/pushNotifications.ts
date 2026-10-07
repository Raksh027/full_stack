import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { Alert, Platform } from 'react-native';
import { getLocales } from 'react-native-localize';

import type { InboxNotification } from '@/features/notifications/api/notificationsApi';
import { notificationsApi } from '@/features/notifications/api/notificationsApi';
import { openNotification } from '@/features/notifications/utils/openNotification';
import { baseApi } from '@/services/api/baseApi';
import { storage } from '@/services/storage/storage';
import { StorageKeys } from '@/services/storage/storageKeys';
import type { AppStore } from '@/store';

const APP_VERSION = '1.0';

function fcmDeviceId(): string {
  const existing = storage.getString(StorageKeys.fcmDeviceId);
  if (existing) {
    return existing;
  }
  const created = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
  storage.set(StorageKeys.fcmDeviceId, created);
  return created;
}

function textValue(
  data: FirebaseMessagingTypes.RemoteMessage['data'],
  key: string,
): string | undefined {
  const value = data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function remoteToInbox(
  message: FirebaseMessagingTypes.RemoteMessage,
): InboxNotification {
  const data = message.data ?? {};
  return {
    id: message.messageId ?? textValue(data, 'id') ?? '',
    type: textValue(data, 'type') ?? '',
    title: message.notification?.title ?? textValue(data, 'title') ?? '',
    body: message.notification?.body ?? textValue(data, 'body') ?? '',
    data: data as Record<string, unknown>,
    relatedEntityId:
      textValue(data, 'entityId') ??
      textValue(data, 'entity_id') ??
      textValue(data, 'relatedEntityId'),
    isRead: false,
    createdAt: null,
  };
}

async function registerToken(store: AppStore, token: string) {
  const locale = getLocales()[0]?.languageTag ?? 'en';
  const result = await store
    .dispatch(
      notificationsApi.endpoints.registerDevice.initiate({
        pushToken: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: APP_VERSION,
        locale,
        deviceId: fcmDeviceId(),
      }),
    )
    .unwrap();
  if (result?.id) {
    storage.set(StorageKeys.fcmRegistrationId, result.id);
  }
}

let refreshUnsub: (() => void) | null = null;
let foregroundUnsub: (() => void) | null = null;
let openedUnsub: (() => void) | null = null;

function stopListeners() {
  refreshUnsub?.();
  foregroundUnsub?.();
  openedUnsub?.();
  refreshUnsub = null;
  foregroundUnsub = null;
  openedUnsub = null;
}

/**
 * Show an in-app banner when a push notification arrives while the app is
 * in the foreground.  Tapping "View" navigates to the relevant screen.
 *
 * NOTE: Replace Alert with a proper toast/snackbar library (e.g. notifee)
 * once added to the project to get richer, non-blocking banners.
 */
export async function displayPushNotification(item: InboxNotification) {
  const title = item.title || 'BoomBoom';
  const body = item.body;
  if (!body && !title) return;
  Alert.alert(title, body ?? undefined, [
    { text: 'Dismiss', style: 'cancel' },
    { text: 'View', onPress: () => openNotification(item) },
  ]);
}

export async function startPushNotifications(store: AppStore) {
  stopListeners();
  const status = await messaging().requestPermission();
  const allowed =
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL ||
    Platform.OS === 'android';

  refreshUnsub = messaging().onTokenRefresh(token => {
    void registerToken(store, token).catch(() => undefined);
  });
  foregroundUnsub = messaging().onMessage(async message => {
    // Always refresh the notification badge/inbox.
    store.dispatch(baseApi.util.invalidateTags(['Notifications']));
    // Show an in-app alert so the user sees the push while the app is open.
    const item = remoteToInbox(message);
    await displayPushNotification(item);
  });
  openedUnsub = messaging().onNotificationOpenedApp(message => {
    openNotification(remoteToInbox(message));
  });

  const initial = await messaging().getInitialNotification();
  if (initial) {
    openNotification(remoteToInbox(initial));
  }
  if (!allowed) {
    return;
  }
  try {
    const token = await messaging().getToken();
    if (token) {
      await registerToken(store, token);
    }
  } catch {
    // APNs can lag the first launch. onTokenRefresh registers the token later.
  }
}

export async function stopPushNotifications(store: AppStore) {
  stopListeners();
  const deviceId = storage.getString(StorageKeys.fcmRegistrationId);
  if (!deviceId) {
    return;
  }
  storage.remove(StorageKeys.fcmRegistrationId);
  try {
    await store
      .dispatch(
        notificationsApi.endpoints.unregisterDevice.initiate({ deviceId }),
      )
      .unwrap();
  } catch {
    // Logout should continue if the device row is already gone.
  }
}
