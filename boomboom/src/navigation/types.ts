import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ID } from '@/shared/types/api';

export type AuthStackParamList = {
  Welcome: undefined;
  Terms: undefined;
  EmailSignIn: undefined;
  VerifyOtp: { email: string };
};

export type OnboardingStackParamList = {
  Location: undefined;
  BasicInfo: undefined;
  Photos: undefined;
  Gender: undefined;
  Orientation: undefined;
  SexualOrientation: undefined;
  RelationshipGoal: undefined;
  Lifestyle: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Nearby: undefined;
  Boom: undefined;
  Likes: undefined;
  Conversations: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  VerifyEmail: undefined;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Chat: {
    conversationId: ID;
    requestAccepted?: boolean;
    showSafetyPrompt?: boolean;
  };
  UserProfile: { userId: ID };
  EditProfile: undefined;
  VerifyProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  BlockedUsers: undefined;
  HelpSupport: undefined;
  SendFeedback: undefined;
  DeleteAccount: undefined;
  DiscoveryPreferences: undefined;
  BrowseEveryone:
    | { mode?: 'everyone' | 'new' | 'active' | 'verified' }
    | undefined;
  TravelAlert: undefined;
  TravelArrivalDetail: { arrivalId: string };
  FreeTonight: undefined;
  FreeTonightDetail: { personId: string };
  CreateFreeTonight: undefined;
  MyJourneys: undefined;
  CreateJourney: { journeyId?: string } | undefined;
  ItsAMatch: {
    matchId: ID;
    conversationId: ID;
    name?: string;
    photo?: string | null;
  };
  Report: { userId: ID };
  Paywall: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AuthStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type OnboardingStackScreenProps<
  T extends keyof OnboardingStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<OnboardingStackParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
