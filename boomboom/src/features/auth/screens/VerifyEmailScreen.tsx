import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EMAIL_VERIFICATION } from '@/config/constants';
import { PrimaryButton } from '@/shared/components';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { showErrorAlert } from '@/shared/utils/alerts';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { colors, fontSize, screen, verticalScale } from '@/theme';

import {
  useResendVerificationEmailMutation,
  useVerifyEmailMutation,
} from '../api/authApi';
import { AuthLayout } from '../components/AuthLayout';
import { CodeInput } from '../components/CodeInput';
import { emailVerificationSchema } from '../schemas';
import { selectSessionUser } from '../store/authSlice';
import { signOut } from '../store/authThunks';

export function VerifyEmailScreen() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const email = useAppSelector(selectSessionUser)?.email ?? '';
  const [code, setCode] = useState('');
  const [verifyEmail, { isLoading: isVerifying }] = useVerifyEmailMutation();
  const [resendCode, { isLoading: isResending }] =
    useResendVerificationEmailMutation();
  const countdown = useCountdown();
  const { start: startCountdown } = countdown;

  // The sign-up request already sent the first code.
  useEffect(() => {
    startCountdown(EMAIL_VERIFICATION.resendCooldownSeconds);
  }, [startCountdown]);

  const submit = async (value: string) => {
    const parsed = emailVerificationSchema.safeParse({ code: value });
    if (!parsed.success) {
      Alert.alert(t('common.error'), parsed.error.issues[0]?.message);
      return;
    }
    try {
      await verifyEmail({ email, code: parsed.data.code }).unwrap();
    } catch (error) {
      setCode('');
      showErrorAlert(error);
    }
  };

  const handleResend = async () => {
    try {
      await resendCode({ email }).unwrap();
      startCountdown(EMAIL_VERIFICATION.resendCooldownSeconds);
      Alert.alert(t('auth.verifyTitle'), t('auth.codeSent'));
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const resendDisabled = countdown.isRunning || isResending;

  return (
    <AuthLayout brandName={t('common.appName')}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.verifySubtitle', {
            count: EMAIL_VERIFICATION.codeLength,
            email,
          })}
        </Text>

        <CodeInput
          length={EMAIL_VERIFICATION.codeLength}
          value={code}
          onChange={setCode}
          onComplete={submit}
          editable={!isVerifying}
        />

        <PrimaryButton
          label={t('auth.verify')}
          onPress={() => submit(code)}
          loading={isVerifying}
          style={styles.verifyButton}
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>{t('auth.noCode')}</Text>
          <Pressable
            onPress={handleResend}
            disabled={resendDisabled}
            hitSlop={8}
          >
            <Text
              style={[
                styles.resendLink,
                resendDisabled && styles.resendLinkDisabled,
              ]}
            >
              {countdown.isRunning
                ? t('auth.resendIn', { seconds: countdown.secondsLeft })
                : t('auth.resend')}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => dispatch(signOut())} hitSlop={8}>
          <Text style={styles.switchAccount}>
            {t('auth.useDifferentAccount')}
          </Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: screen.width * 0.055,
    marginBottom: verticalScale(8),
    color: colors.textPrimary,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: screen.width * 0.035,
    marginBottom: verticalScale(24),
    color: colors.textMuted,
    textAlign: 'center',
  },
  verifyButton: {
    width: '80%',
    marginTop: verticalScale(32),
    marginBottom: verticalScale(24),
  },
  resendRow: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resendPrompt: {
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  resendLink: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: 'bold',
  },
  resendLinkDisabled: {
    color: colors.placeholder,
  },
  switchAccount: {
    marginTop: verticalScale(32),
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textDecorationLine: 'underline',
  },
});
