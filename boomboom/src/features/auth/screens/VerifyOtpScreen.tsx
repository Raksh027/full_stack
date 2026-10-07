import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EMAIL_VERIFICATION, LEGAL_URLS } from '@/config/constants';
import type { AuthStackScreenProps } from '@/navigation/types';
import { Icon, Logo, ScreenContainer } from '@/shared/components';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { showErrorAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';

import {
  useRequestLoginOtpMutation,
  useVerifyLoginOtpMutation,
} from '../api/authApi';
import { CodeInput } from '../components/CodeInput';
import { emailVerificationSchema } from '../schemas';

export function VerifyOtpScreen({
  navigation,
  route,
}: AuthStackScreenProps<'VerifyOtp'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyLoginOtpMutation();
  const [resendCode, { isLoading: isResending }] = useRequestLoginOtpMutation();
  const countdown = useCountdown();
  const { start: startCountdown } = countdown;

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
      await verifyOtp({ email, code: parsed.data.code }).unwrap();
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

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert(t('common.error'), t('settings.openFailed')),
    );
  };

  const resendDisabled = countdown.isRunning || isResending;

  return (
    <ScreenContainer edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.back}
          >
            <Icon name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Logo size={88} />
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

          <Pressable
            accessibilityRole="button"
            onPress={() => submit(code)}
            disabled={isVerifying}
            style={({ pressed }) => [styles.block, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[...colors.gradientFill]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}
            >
              {isVerifying ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <>
                  <Text style={styles.ctaText}>{t('auth.verify')}</Text>
                  <Icon name="arrow-forward" size={16} color={palette.white} />
                </>
              )}
            </LinearGradient>
          </Pressable>

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

          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.switchAccount}>
              {t('auth.useDifferentAccount')}
            </Text>
          </Pressable>
        </ScrollView>

        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => openLink(LEGAL_URLS.privacy)}
            style={styles.footerLink}
          >
            <Icon
              name="shield-checkmark-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.footerText}>{t('auth.dataSecurity')}</Text>
            <Icon name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
          <View style={styles.footerRule} />
          <Pressable
            accessibilityRole="button"
            onPress={() => openLink(LEGAL_URLS.privacy)}
            style={styles.footerLink}
          >
            <Icon
              name="document-text-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.footerText}>{t('auth.privacyPolicy')}</Text>
            <Icon name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 4,
  },
  block: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
  resendRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  resendPrompt: {
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  resendLink: {
    color: colors.gradientBorder[1],
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: colors.textMuted,
  },
  switchAccount: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A32',
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  footerLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  footerRule: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: '#3A3A44',
  },
});
