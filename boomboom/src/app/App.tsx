import { useEffect } from 'react';

import { initI18n } from '@/services/i18n';
import { store } from '@/store';

import { AppContent } from './AppContent';
import { AppProviders } from './AppProviders';
import { bootstrapApp } from './bootstrap';

initI18n(store.getState().preferences.language);

export function App() {
  useEffect(() => bootstrapApp(store), []);

  return (
    <AppProviders store={store}>
      <AppContent />
    </AppProviders>
  );
}
