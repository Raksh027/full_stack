import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';

import { ONBOARDING_STEPS } from '@/features/onboarding/onboardingSteps';
import {
  BasicInfoScreen,
  GenderScreen,
  LifestyleScreen,
  LocationScreen,
  OrientationScreen,
  PhotosScreen,
  RelationshipGoalScreen,
  SexualOrientationScreen,
} from '@/features/onboarding/screens';
import { colors } from '@/theme';

import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const SCREENS: Record<keyof OnboardingStackParamList, ComponentType> = {
  Location: LocationScreen,
  BasicInfo: BasicInfoScreen,
  Photos: PhotosScreen,
  Gender: GenderScreen,
  Orientation: OrientationScreen,
  SexualOrientation: SexualOrientationScreen,
  RelationshipGoal: RelationshipGoalScreen,
  Lifestyle: LifestyleScreen,
};

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={ONBOARDING_STEPS[0]}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {ONBOARDING_STEPS.map(step => (
        <Stack.Screen key={step} name={step} component={SCREENS[step]} />
      ))}
    </Stack.Navigator>
  );
}
