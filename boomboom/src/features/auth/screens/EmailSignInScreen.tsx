import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
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
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LEGAL_URLS } from '@/config/constants';
import type { AuthStackScreenProps } from '@/navigation/types';
import { Icon, Logo, ScreenContainer } from '@/shared/components';
import { handleFormSubmitError } from '@/shared/utils/forms';
import { colors, fontSize, palette } from '@/theme';

import { useRequestLoginOtpMutation } from '../api/authApi';
import { SocialSignInButtons } from '../components/SocialSignInButtons';
import { emailSignInSchema, type EmailSignInForm } from '../schemas';

export function EmailSignInScreen({
  navigation,
}: AuthStackScreenProps<'EmailSignIn'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [requestOtp, { isLoading }] = useRequestLoginOtpMutation();

  const { control, handleSubmit, setError } = useForm<EmailSignInForm>({
    resolver: zodResolver(emailSignInSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await requestOtp({ email }).unwrap();
      navigation.navigate('VerifyOtp', { email });
    } catch (error) {
      handleFormSubmitError(error, setError, ['email'], t('auth.otpFailed'));
    }
  });

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert(t('common.error'), t('settings.openFailed')),
    );
  };

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
          <Text style={styles.title}>{t('auth.signInTitle')}</Text>

          <LinearGradient
            colors={[...colors.gradientBorder]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.methodBorder}
          >
            <View style={styles.method}>
              <View style={styles.methodIcon}>
                <Icon name="mail-outline" size={18} color={colors.textPrimary} />
              </View>
              <View style={styles.methodCopy}>
                <Text style={styles.methodTitle}>{t('auth.emailTab')}</Text>
                <Text style={styles.methodHint}>{t('auth.emailOtpHint')}</Text>
              </View>
              <View style={styles.methodIcon}>
                <Icon name="person-outline" size={18} color={colors.textSecondary} />
              </View>
            </View>
          </LinearGradient>

          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <View style={styles.block}>
                <LinearGradient
                  colors={
                    fieldState.error
                      ? [colors.danger, colors.danger]
                      : [...colors.gradientBorder]
                  }
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.fieldBorder}
                >
                  <View style={styles.field}>
                    <Icon name="mail-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor="#6B6B78"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="done"
                      onSubmitEditing={() => onSubmit()}
                      editable={!isLoading}
                      style={styles.input}
                    />
                  </View>
                </LinearGradient>
                {fieldState.error?.message ? (
                  <Text style={styles.error}>{fieldState.error.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => onSubmit()}
            disabled={isLoading}
            style={({ pressed }) => [styles.block, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[...colors.gradientFill]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}
            >
              {isLoading ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <>
                  <Text style={styles.ctaText}>{t('auth.sendEmailOtp')}</Text>
                  <Icon name="arrow-forward" size={16} color={palette.white} />
                </>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
            <View style={styles.line} />
          </View>

          <SocialSignInButtons disabled={isLoading} />

          <View style={styles.secure}>
            <Icon name="lock-closed" size={12} color={colors.textMuted} />
            <Text style={styles.secureText}>{t('auth.dataSafe')}</Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => openLink(LEGAL_URLS.privacy)}
            style={styles.footerLink}
          >
            <Icon name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>{t('auth.dataSecurity')}</Text>
            <Icon name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
          <View style={styles.footerRule} />
          <Pressable
            accessibilityRole="button"
            onPress={() => openLink(LEGAL_URLS.privacy)}
            style={styles.footerLink}
          >
            <Icon name="document-text-outline" size={16} color={colors.textSecondary} />
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
  block: {
    alignSelf: 'stretch',
  },
  title: {
    marginTop: 8,
    marginBottom: 6,
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '700',
    textAlign: 'center',
  },
  methodBorder: {
    alignSelf: 'stretch',
    borderRadius: 22,
    padding: 1.5,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20.5,
    backgroundColor: '#101014',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCopy: {
    flex: 1,
    gap: 2,
  },
  methodTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  methodHint: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
  },
  fieldBorder: {
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 1.5,
  },
  field: {
    height: 54,
    borderRadius: 16.5,
    backgroundColor: '#121218',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    paddingVertical: 0,
  },
  error: {
    alignSelf: 'stretch',
    marginTop: 6,
    color: colors.danger,
    fontSize: fontSize(12),
  },
  cta: {
    alignSelf: 'stretch',
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
  divider: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#3A3A44',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  secure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  secureText: {
    color: colors.textMuted,
    fontSize: fontSize(12),
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
