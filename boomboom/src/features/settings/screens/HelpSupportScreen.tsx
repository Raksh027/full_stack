import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { SettingsPageHeader } from '../components/SettingsPageHeader';

type Props = RootStackScreenProps<'HelpSupport'>;

const SUPPORT_EMAIL = 'support@boomboom.app';
const PINK = '#FF2D8B';

export function HelpSupportScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const contact = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=BoomBoom%20Support`).catch(
      () => Alert.alert(t('common.error'), t('settings.openFailed')),
    );
  };

  return (
    <ScreenContainer edges={['top']}>
      <SettingsPageHeader
        title={t('settings.help')}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon name="mail" size={22} color={PINK} />
          </View>
          <Text style={styles.cardTitle}>{t('settings.helpPage.emailTitle')}</Text>
          <Text style={styles.cardHint}>{t('settings.helpPage.emailHint')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={contact}
            style={styles.emailPill}
          >
            <Icon name="mail-outline" size={16} color={palette.white} />
            <Text style={styles.emailText}>{SUPPORT_EMAIL}</Text>
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.etaRow}>
            <Icon name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.eta}>{t('settings.helpPage.eta')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={contact}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{t('settings.helpPage.contact')}</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2A0A18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
    marginBottom: 8,
  },
  cardHint: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1C1220',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  emailText: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2A2A2A',
    alignSelf: 'stretch',
    marginVertical: 18,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  eta: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  cta: {
    backgroundColor: PINK,
    borderRadius: 28,
    height: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
});
