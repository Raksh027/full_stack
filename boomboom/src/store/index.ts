import { configureStore } from '@reduxjs/toolkit';

import { loadPersistedPreferences } from '@/features/settings/store/preferencesSlice';
import { baseApi } from '@/services/api/baseApi';

import { listenerMiddleware } from './listenerMiddleware';
import { registerListeners } from './listeners';
import { rootReducer, type RootState } from './rootReducer';

export function createStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: {
      preferences: loadPersistedPreferences(),
      ...preloadedState,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware()
        .prepend(listenerMiddleware.middleware)
        .concat(baseApi.middleware),
  });
}

registerListeners();

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore['dispatch'];
export type { RootState };
