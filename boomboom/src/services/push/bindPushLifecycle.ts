import { selectIsAuthenticated } from '@/features/auth/store/authSlice';
import type { AppStore } from '@/store';

import {
  startPushNotifications,
  stopPushNotifications,
} from './pushNotifications';

export function bindPushLifecycle(store: AppStore): () => void {
  let lastAuthenticated = selectIsAuthenticated(store.getState());
  if (lastAuthenticated) {
    void startPushNotifications(store);
  }

  const unsubscribe = store.subscribe(() => {
    const authenticated = selectIsAuthenticated(store.getState());
    if (authenticated === lastAuthenticated) {
      return;
    }
    lastAuthenticated = authenticated;
    if (authenticated) {
      void startPushNotifications(store);
    } else {
      void stopPushNotifications(store);
    }
  });

  return () => {
    unsubscribe();
    void stopPushNotifications(store);
  };
}
