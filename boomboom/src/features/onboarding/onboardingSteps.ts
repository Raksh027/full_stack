import type { OnboardingStackParamList } from '@/navigation/types';

export type OnboardingStep = keyof OnboardingStackParamList;

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'BasicInfo',
  'Orientation',
  'SexualOrientation',
  'Lifestyle',
];

export function getNextStep(current: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(current);
  return ONBOARDING_STEPS[index + 1] ?? null;
}
