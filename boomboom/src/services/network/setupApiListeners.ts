import NetInfo from '@react-native-community/netinfo';
import { setupListeners } from '@reduxjs/toolkit/query';
import { AppState } from 'react-native';

import type { AppDispatch } from '@/store';
import { connectivityChanged } from '@/store/appSlice';

// RTK Query's default listeners rely on browser events, so wire up the
// React Native equivalents to get refetch-on-focus/reconnect behaviour.
export function setupApiListeners(dispatch: AppDispatch): () => void {
  return setupListeners(
    dispatch,
    (innerDispatch, { onFocus, onFocusLost, onOnline, onOffline }) => {
      const appStateSubscription = AppState.addEventListener(
        'change',
        state => {
          innerDispatch(state === 'active' ? onFocus() : onFocusLost());
        },
      );

      const unsubscribeNetInfo = NetInfo.addEventListener(state => {
        const isOnline =
          state.isConnected !== false && state.isInternetReachable !== false;
        innerDispatch(isOnline ? onOnline() : onOffline());
        innerDispatch(connectivityChanged(isOnline));
      });

      return () => {
        appStateSubscription.remove();
        unsubscribeNetInfo();
      };
    },
  );
}
