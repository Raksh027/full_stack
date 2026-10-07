import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showErrorAlert } from '@/shared/utils/alerts';
import { useAppDispatch } from '@/store/hooks';

import {
  signInWithApple,
  signInWithFacebook,
  signInWithGoogle,
} from '../store/authThunks';

type SocialProvider = 'google' | 'apple' | 'facebook';

const thunks = {
  google: signInWithGoogle,
  apple: signInWithApple,
  facebook: signInWithFacebook,
} as const;

export function useSocialSignIn() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(
    null,
  );

  const signIn = useCallback(
    async (provider: SocialProvider) => {
      setPendingProvider(provider);
      const result = await dispatch(thunks[provider]());
      setPendingProvider(null);
      if (result.meta.requestStatus === 'rejected') {
        showErrorAlert(result.payload, t('auth.signInFailed'));
      }
    },
    [dispatch, t],
  );

  return { signIn, pendingProvider };
}
