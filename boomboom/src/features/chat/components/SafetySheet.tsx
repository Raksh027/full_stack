import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { chatAccent } from '../theme';

const RISKS: { icon: IconName; key: 'phone' | 'social' | 'location' | 'payment' | 'otp' }[] =
  [
    { icon: 'call-outline', key: 'phone' },
    { icon: 'globe-outline', key: 'social' },
    { icon: 'location-outline', key: 'location' },
    { icon: 'card-outline', key: 'payment' },
    { icon: 'lock-closed-outline', key: 'otp' },
  ];

type Props = {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
};

export function SafetySheet({ visible, onClose, onContinue }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Icon name="close" size={18} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.titleRow}>
            <Icon name="shield" size={18} color="#F5C400" />
            <Text style={styles.title}>{t('chat.safetyTitle')}</Text>
          </View>
          <Text style={styles.lead}>{t('chat.safetyLead')}</Text>
          <Text style={styles.careful}>{t('chat.safetyCareful')}</Text>
          <View style={styles.list}>
            {RISKS.map(item => (
              <View key={item.key} style={styles.risk}>
                <Icon name={item.icon} size={16} color={colors.textSecondary} />
                <Text style={styles.riskText}>{t(`chat.safety.${item.key}`)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.warn}>
            <Icon name="close-circle" size={16} color={colors.danger} />
            <Text style={styles.warnText}>{t('chat.safetyMoney')}</Text>
          </View>
          <View style={styles.safe}>
            <Icon name="shield-checkmark" size={16} color={chatAccent.blue} />
            <Text style={styles.safeText}>{t('chat.safetyStay')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={styles.continue}
          >
            <Text style={styles.continueLabel}>{t('chat.safetyContinue')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#161616',
    padding: 20,
    borderWidth: 1,
    borderColor: palette.gray850,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 28,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
  lead: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    lineHeight: 19,
  },
  careful: {
    marginTop: 16,
    marginBottom: 8,
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  risk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#111111',
  },
  riskText: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
  },
  warnText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(13),
    lineHeight: 18,
    fontWeight: '600',
  },
  safe: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  safeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  continue: {
    marginTop: 18,
    height: 50,
    borderRadius: 25,
    backgroundColor: chatAccent.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: {
    color: palette.white,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});
