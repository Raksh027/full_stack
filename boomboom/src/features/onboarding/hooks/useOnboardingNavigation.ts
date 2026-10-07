import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import type { OnboardingStackParamList } from '@/navigation/types';

import { getNextStep, type OnboardingStep } from '../onboardingSteps';

export function useOnboardingNavigation() {
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const route = useRoute();

  const goToNextStep = useCallback(() => {
    const next = getNextStep(route.name as OnboardingStep);
    if (next) {
      navigation.navigate(next);
    }
  }, [navigation, route.name]);

  return { goToNextStep };
}
