import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  selectAuthStatus,
  selectIsSigningOut,
  selectSessionUser,
} from '@/features/auth/store/authSlice';
import { VerifyEmailScreen } from '@/features/auth/screens';
import { ChatScreen } from '@/features/chat/screens';
import { UserProfileScreen } from '@/features/discovery/screens/UserProfileScreen';
import { BrowseEveryoneScreen } from '@/features/discovery/screens/BrowseEveryoneScreen';
import { TravelAlertScreen } from '@/features/discovery/screens/TravelAlertScreen';
import { TravelArrivalDetailScreen } from '@/features/discovery/screens/TravelArrivalDetailScreen';
import { FreeTonightScreen } from '@/features/discovery/screens/FreeTonightScreen';
import { FreeTonightDetailScreen } from '@/features/discovery/screens/FreeTonightDetailScreen';
import { CreateFreeTonightScreen } from '@/features/discovery/screens/CreateFreeTonightScreen';
import { MyJourneysScreen } from '@/features/discovery/screens/MyJourneysScreen';
import { CreateJourneyScreen } from '@/features/discovery/screens/CreateJourneyScreen';
import {
  BlockedUsersScreen,
  DeleteAccountScreen,
  DiscoveryPreferencesScreen,
  EditProfileScreen,
  HelpSupportScreen,
  NotificationSettingsScreen,
  SendFeedbackScreen,
  SettingsScreen,
  VerifyProfileScreen,
} from '@/features/settings/screens';
import { NotificationsScreen } from '@/features/notifications';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme';

import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { ItsAMatchScreen } from '@/features/matches/screens/ItsAMatchScreen';
import { ReportScreen } from '@/features/safety/screens/ReportScreen';
import { PaywallScreen } from '@/features/subscription/screens/PaywallScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type AuthBranch = 'auth' | 'verify' | 'onboarding' | 'main';

function useDisplayedAuthBranch(branch: AuthBranch) {
  const [displayed, setDisplayed] = useState(branch);

  useEffect(() => {
    if (branch === displayed) {
      return;
    }

    // Native-stack onboarding cannot unmount in the same Fabric transaction as
    // Main (LinearGradient + RNGH). Recycle-mounted-view abort on iOS.
    const leavingOnboarding = displayed === 'onboarding' && branch === 'main';
    if (!leavingOnboarding) {
      setDisplayed(branch);
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (!cancelled) {
            setDisplayed(branch);
          }
        }, 80);
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [branch, displayed]);

  return displayed;
}

// Screens are switched by auth state rather than navigated to, so a signed-out
// user can never reach authenticated routes via back navigation or deep links.
export function RootNavigator() {
  const { t } = useTranslation();
  const status = useAppSelector(selectAuthStatus);
  const user = useAppSelector(selectSessionUser);
  const isSigningOut = useAppSelector(selectIsSigningOut);

  const needsEmailVerification =
    user?.provider === 'email' && !user.isEmailVerified;

  const branch: AuthBranch =
    status === 'restoring'
      ? 'auth'
      : status !== 'authenticated'
        ? 'auth'
        : needsEmailVerification
          ? 'verify'
          : !user?.isOnboarded
            ? 'onboarding'
            : 'main';

  const displayed = useDisplayedAuthBranch(
    status === 'restoring' ? 'auth' : branch,
  );

  if (status === 'restoring') {
    return null;
  }

  return (
    <View style={styles.root}>
    <Stack.Navigator
      key={displayed}
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: displayed === 'main' ? 'fade' : 'none',
      }}
    >
      {displayed === 'auth' ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : displayed === 'verify' ? (
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      ) : displayed === 'onboarding' ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="BrowseEveryone" component={BrowseEveryoneScreen} />
          <Stack.Screen name="TravelAlert" component={TravelAlertScreen} />
          <Stack.Screen
            name="TravelArrivalDetail"
            component={TravelArrivalDetailScreen}
          />
          <Stack.Screen name="FreeTonight" component={FreeTonightScreen} />
          <Stack.Screen
            name="FreeTonightDetail"
            component={FreeTonightDetailScreen}
          />
          <Stack.Screen
            name="CreateFreeTonight"
            component={CreateFreeTonightScreen}
          />
          <Stack.Screen name="MyJourneys" component={MyJourneysScreen} />
          <Stack.Screen name="CreateJourney" component={CreateJourneyScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen
            name="VerifyProfile"
            component={VerifyProfileScreen}
          />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
          />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
          <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
          <Stack.Screen name="SendFeedback" component={SendFeedbackScreen} />
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Group screenOptions={{ presentation: 'modal' }}>
            <Stack.Screen
              name="DiscoveryPreferences"
              component={DiscoveryPreferencesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Report" component={ReportScreen} />
          </Stack.Group>
          <Stack.Screen name="Paywall" component={PaywallScreen} />
          <Stack.Screen
            name="ItsAMatch"
            component={ItsAMatchScreen}
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
        </>
      )}
    </Stack.Navigator>
      {isSigningOut ? (
        <View style={styles.logoutOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={styles.logoutText}>{t('settings.loggingOut')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 100,
  },
  logoutText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
