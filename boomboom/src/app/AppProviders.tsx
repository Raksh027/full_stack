import { NavigationContainer } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

import { linking } from '@/navigation/linking';
import { navigationRef } from '@/navigation/navigationRef';
import { AppErrorBoundary } from '@/shared/components';
import type { AppStore } from '@/store';

type Props = PropsWithChildren<{ store: AppStore }>;

export function AppProviders({ store, children }: Props) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ReduxProvider store={store}>
        <SafeAreaProvider>
          <AppErrorBoundary>
            <NavigationContainer ref={navigationRef} linking={linking}>
              {children}
            </NavigationContainer>
          </AppErrorBoundary>
        </SafeAreaProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
