import { useCallback, useState } from 'react';

import { selectAuthStatus } from '@/features/auth/store/authSlice';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAppSelector } from '@/store/hooks';

import { SplashScreen } from './splash/SplashScreen';

export function AppContent() {
  const authStatus = useAppSelector(selectAuthStatus);
  const [splashTimeElapsed, setSplashTimeElapsed] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashTimeElapsed(true), []);

  const showSplash = !splashTimeElapsed || authStatus === 'restoring';

  return (
    <>
      <RootNavigator />
      {showSplash ? <SplashScreen onFinish={handleSplashFinish} /> : null}
    </>
  );
}
