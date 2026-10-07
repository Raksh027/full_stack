import { useCallback } from 'react';

import {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} from '@/features/profile/api/profileApi';
import type { UpdateProfileRequest } from '@/features/profile/types';
import { showErrorAlert } from '@/shared/utils/alerts';

import { useOnboardingNavigation } from './useOnboardingNavigation';

/** Loads the profile for pre-filling a step and saves the step before moving on. */
export function useProfileStep() {
  const { data: profile } = useGetMyProfileQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateMyProfileMutation();
  const { goToNextStep } = useOnboardingNavigation();

  const saveAndContinue = useCallback(
    async (patch: UpdateProfileRequest) => {
      try {
        await updateProfile(patch).unwrap();
        goToNextStep();
      } catch (error) {
        showErrorAlert(error);
      }
    },
    [goToNextStep, updateProfile],
  );

  return { profile, isSaving, saveAndContinue };
}
