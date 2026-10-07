import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useRequestEmailChangeMutation,
  useVerifyEmailChangeMutation,
} from '@/features/profile/api/profileApi';
import { Icon, PrimaryButton, TextField } from '@/shared/components';
import { showErrorAlert, showSuccessAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';

type Props = {
  visible: boolean;
  currentEmail: string | null;
  onClose: () => void;
};

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function ChangeEmailSheet({ visible, currentEmail, onClose }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [requestChange, { isLoading: sending }] = useRequestEmailChangeMutation();
  const [verifyChange, { isLoading: verifying }] = useVerifyEmailChangeMutation();

  useEffect(() => {
    if (!visible) {
      setEmail('');
      setCode('');
      setOtpSent(false);
    }
  }, [visible]);

  const nextEmail = email.trim().toLowerCase();
  const current = (currentEmail ?? '').trim().toLowerCase();

  const sendOtp = async () => {
    if (!looksLikeEmail(nextEmail)) {
      showErrorAlert({
        status: 400,
        message: t('settings.emailChange.invalidEmail'),
      });
      return;
    }
    if (nextEmail === current) {
      showErrorAlert({
        status: 400,
        message: t('settings.emailChange.sameEmail'),
      });
      return;
    }
    try {
      await requestChange({ email: nextEmail }).unwrap();
      setOtpSent(true);
      setCode('');
      showSuccessAlert(t('settings.emailChange.otpSent', { email: nextEmail }));
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const verify = async () => {
    if (code.trim().length < 4) {
      showErrorAlert({
        status: 400,
        message: t('settings.emailChange.invalidOtp'),
      });
      return;
    }
    try {
      await verifyChange({ email: nextEmail, code: code.trim() }).unwrap();
      showSuccessAlert(t('settings.emailChange.success'), t('common.success'), onClose);
    } catch (error) {
      showErrorAlert(error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('settings.emailChange.title')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              hitSlop={8}
              onPress={onClose}
            >
              <Icon name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.lead}>{t('settings.emailChange.lead')}</Text>
          {current ? (
            <Text style={styles.current}>
              {t('settings.emailChange.current', { email: currentEmail })}
            </Text>
          ) : null}

          <TextField
            variant="gradient"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder={t('settings.emailChange.newPlaceholder')}
            editable={!sending && !verifying}
          />

          {otpSent ? (
            <TextField
              variant="gradient"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={8}
              placeholder={t('settings.emailChange.otpPlaceholder')}
              editable={!verifying}
            />
          ) : null}

          <PrimaryButton
            label={
              otpSent
                ? t('settings.emailChange.verify')
                : t('settings.emailChange.sendOtp')
            }
            loading={otpSent ? verifying : sending}
            onPress={otpSent ? () => void verify() : () => void sendOtp()}
          />

          {otpSent ? (
            <Pressable
              accessibilityRole="button"
              disabled={sending}
              onPress={() => void sendOtp()}
              style={({ pressed }) => [styles.resend, pressed && styles.pressed]}
            >
              <Text style={styles.resendText}>
                {t('settings.emailChange.resend')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: palette.gray900,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingBottom: 28,
    paddingTop: 10,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray600,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '700',
  },
  lead: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  current: {
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  resend: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  resendText: {
    color: palette.pink,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
