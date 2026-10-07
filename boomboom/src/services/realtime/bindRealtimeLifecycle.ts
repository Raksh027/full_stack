import { AppState } from 'react-native';

import { authApi } from '@/features/auth/api/authApi';
import { selectIsAuthenticated } from '@/features/auth/store/authSlice';
import type { AppStore } from '@/store';
import { realtimeStatusChanged } from '@/store/appSlice';

import { realtime, setRealtimeUnauthorizedHandler } from './realtime';

// Stay connected while backgrounded so like/view/match can raise a local
// banner. The OS still suspends the socket after a short time.
export function bindRealtimeLifecycle(store: AppStore): () => void {
  const unsubscribeStatus = realtime.onStatusChange(status => {
    store.dispatch(realtimeStatusChanged(status));
  });

  const appStateSubscription = AppState.addEventListener('change', state => {
    if (state === 'active' && selectIsAuthenticated(store.getState())) {
      realtime.connect();
    }
  });

  // An authenticated request goes through the reauth base query, which
  // refreshes the access token before the socket reconnects with it.
  setRealtimeUnauthorizedHandler(async () => {
    const request = store.dispatch(
      authApi.endpoints.getSession.initiate(undefined, { forceRefetch: true }),
    );
    const result = await request;
    request.unsubscribe();
    if (result.data && selectIsAuthenticated(store.getState())) {
      realtime.connect();
    }
  });

  return () => {
    unsubscribeStatus();
    appStateSubscription.remove();
    setRealtimeUnauthorizedHandler(null);
  };
}
