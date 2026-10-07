import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RealtimeStatus } from '@/services/realtime/RealtimeClient';

type AppState = {
  isOnline: boolean;
  realtimeStatus: RealtimeStatus;
};

const initialState: AppState = {
  isOnline: true,
  realtimeStatus: 'idle',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    connectivityChanged(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    realtimeStatusChanged(state, action: PayloadAction<RealtimeStatus>) {
      state.realtimeStatus = action.payload;
    },
  },
  selectors: {
    selectIsOnline: state => state.isOnline,
    selectRealtimeStatus: state => state.realtimeStatus,
  },
});

export const { connectivityChanged, realtimeStatusChanged } = appSlice.actions;
export const { selectIsOnline, selectRealtimeStatus } = appSlice.selectors;
export const appReducer = appSlice.reducer;
