import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { getJSON } from '@/services/storage/storage';
import { StorageKeys } from '@/services/storage/storageKeys';

import type { AppPreferences, DistanceUnit, ThemeMode } from '../types';

const defaultPreferences: AppPreferences = {
  themeMode: 'system',
  language: null,
  distanceUnit: 'km',
  hapticsEnabled: true,
  crossPathEnabled: true,
  termsAcceptedAt: null,
};

export function loadPersistedPreferences(): AppPreferences {
  return {
    ...defaultPreferences,
    ...getJSON<Partial<AppPreferences>>(StorageKeys.preferences),
  };
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: defaultPreferences,
  reducers: {
    themeModeChanged(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    languageChanged(state, action: PayloadAction<string | null>) {
      state.language = action.payload;
    },
    distanceUnitChanged(state, action: PayloadAction<DistanceUnit>) {
      state.distanceUnit = action.payload;
    },
    hapticsToggled(state, action: PayloadAction<boolean>) {
      state.hapticsEnabled = action.payload;
    },
    crossPathToggled(state, action: PayloadAction<boolean>) {
      state.crossPathEnabled = action.payload;
    },
    termsAccepted: {
      reducer(state, action: PayloadAction<string>) {
        state.termsAcceptedAt = action.payload;
      },
      prepare: () => ({ payload: new Date().toISOString() }),
    },
  },
  selectors: {
    selectPreferences: state => state,
    selectThemeMode: state => state.themeMode,
    selectLanguage: state => state.language,
    selectDistanceUnit: state => state.distanceUnit,
    selectCrossPathEnabled: state => state.crossPathEnabled,
    selectHasAcceptedTerms: state => state.termsAcceptedAt !== null,
  },
});

export const {
  themeModeChanged,
  languageChanged,
  distanceUnitChanged,
  hapticsToggled,
  crossPathToggled,
  termsAccepted,
} = preferencesSlice.actions;

export const {
  selectPreferences,
  selectThemeMode,
  selectLanguage,
  selectDistanceUnit,
  selectCrossPathEnabled,
  selectHasAcceptedTerms,
} = preferencesSlice.selectors;

export const preferencesReducer = preferencesSlice.reducer;
export const preferencesSliceName = preferencesSlice.name;
