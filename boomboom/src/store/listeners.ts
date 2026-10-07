import { isAnyOf } from '@reduxjs/toolkit';

import {
  loggedOut,
  sessionExpired,
  sessionStarted,
  sessionUserUpdated,
} from '@/features/auth/store/authSlice';
import {
  languageChanged,
  preferencesSliceName,
} from '@/features/settings/store/preferencesSlice';
import { baseApi } from '@/services/api/baseApi';
import { applyLanguagePreference } from '@/services/i18n';
import { realtime } from '@/services/realtime/realtime';
import { removeItem, setJSON } from '@/services/storage/storage';
import { StorageKeys } from '@/services/storage/storageKeys';

import { startAppListening } from './listenerMiddleware';

const sessionEnded = isAnyOf(loggedOut, sessionExpired);

export function registerListeners() {
  startAppListening({
    predicate: action => action.type.startsWith(`${preferencesSliceName}/`),
    effect: (_action, api) => {
      setJSON(StorageKeys.preferences, api.getState().preferences);
    },
  });

  startAppListening({
    actionCreator: languageChanged,
    effect: action => applyLanguagePreference(action.payload),
  });

  startAppListening({
    matcher: isAnyOf(sessionStarted, sessionUserUpdated),
    effect: (_action, api) => {
      const { user } = api.getState().auth;
      if (user) {
        setJSON(StorageKeys.sessionUser, user);
      }
    },
  });

  startAppListening({
    actionCreator: sessionStarted,
    effect: () => realtime.connect(),
  });

  startAppListening({
    matcher: sessionEnded,
    effect: (_action, api) => {
      realtime.disconnect();
      removeItem(StorageKeys.sessionUser);
      api.dispatch(baseApi.util.resetApiState());
    },
  });
}
