import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useDeleteAccountMutation } from '@/features/auth/api/authApi';
import { clearLocalSession } from '@/features/auth/store/authThunks';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { useAppDispatch } from '@/store/hooks';
import { colors, fontSize, palette } from '@/theme';

import { SettingsPageHeader } from '../components/SettingsPageHeader';

type Props = RootStackScreenProps<'DeleteAccount'>;

const REASONS = [
  'noNeed',
  'privacy',
  'alternative',
  'difficult',
  'other',
] as const;

export function DeleteAccountScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [deleteAccount, { isLoading }] = useDeleteAccountMutation();
  const otherDetails = otherReason.trim();
  const canDelete =
    Boolean(reason) && (reason !== 'other' || otherDetails.length > 0) && !isLoading;

  const removeAccount = async () => {
    if (!canDelete || !reason) {
      return;
    }
    try {
      await deleteAccount({
        reason,
        details: reason === 'other' ? otherDetails : undefined,
      }).unwrap();
      await dispatch(clearLocalSession());
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const confirm = () => {
    if (!canDelete) {
      return;
    }
    Alert.alert(
      t('settings.deleteAccount.confirmTitle'),
      t('settings.deleteAccount.confirmBody'),
      [
        { text: t('settings.deleteAccount.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount.confirm'),
          style: 'destructive',
          onPress: () => {
            void removeAccount();
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer edges={['top']}>
      <SettingsPageHeader
        title={t('settings.deleteAccount.title')}
        onBack={() => navigation.goBack()}
      />
      <Text style={styles.lead}>{t('settings.deleteAccount.lead')}</Text>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        <Text style={styles.section}>{t('settings.deleteAccount.select')}</Text>
        {REASONS.map(key => {
          const selected = reason === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(key)}
              style={styles.option}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={styles.optionText}>
                {t(`settings.deleteAccount.reasons.${key}`)}
              </Text>
            </Pressable>
          );
        })}
        {reason === 'other' ? (
          <TextInput
            value={otherReason}
            onChangeText={setOtherReason}
            placeholder={t('settings.deleteAccount.otherPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
            style={styles.otherInput}
          />
        ) : null}

        <View style={styles.warning}>
          <View style={styles.warningIcon}>
            <Icon name="flash" size={14} color={palette.white} />
          </View>
          <View style={styles.warningCopy}>
            <Text style={styles.warningTitle}>
              {t('settings.deleteAccount.warningTitle')}
            </Text>
            <Text style={styles.warningBody}>
              {t('settings.deleteAccount.warningBody')}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!canDelete}
          onPress={confirm}
          style={[styles.deleteBtn, !canDelete && styles.deleteDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Text style={styles.deleteText}>
              {t('settings.deleteAccount.confirm')}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.cancel}>
          <Text style={styles.cancelText}>{t('settings.deleteAccount.cancel')}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 19,
    marginBottom: 22,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  section: {
    color: colors.textMuted,
    fontSize: fontSize(11),
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#5A5A5A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: palette.white,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.white,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '600',
    flex: 1,
  },
  otherInput: {
    minHeight: 110,
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    color: colors.textPrimary,
    fontSize: fontSize(14),
  },
  warning: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#2A1212',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
  },
  warningIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  warningCopy: {
    flex: 1,
    gap: 4,
  },
  warningTitle: {
    color: '#FB7185',
    fontSize: fontSize(14),
    fontWeight: '800',
  },
  warningBody: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  deleteBtn: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteDisabled: {
    opacity: 0.5,
  },
  deleteText: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
});
