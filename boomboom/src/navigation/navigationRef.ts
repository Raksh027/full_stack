import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

// For navigating from outside React (push notification taps, realtime events).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<T extends keyof RootStackParamList>(
  screen: T,
  params: RootStackParamList[T],
) {
  if (navigationRef.isReady()) {
    navigationRef.navigate({ name: screen, params } as never);
  }
}
