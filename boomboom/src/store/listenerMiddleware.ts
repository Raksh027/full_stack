import { createListenerMiddleware } from '@reduxjs/toolkit';

import type { AppDispatch } from './index';
import type { RootState } from './rootReducer';

export const listenerMiddleware = createListenerMiddleware();

export const startAppListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>();
