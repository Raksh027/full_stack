import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { homeAccent } from '../theme';

type Props = {
  activeOnly: boolean;
  verifiedOnly: boolean;
  onToggleActive: () => void;
  onToggleVerified: () => void;
};

export function FilterChips({
  activeOnly,
  verifiedOnly,
  onToggleActive,
  onToggleVerified,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onToggleActive}
        style={[styles.chip, activeOnly && styles.activeOn]}
      >
        <View style={styles.greenDot} />
        <Text style={styles.label}>{t('home.active')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onToggleVerified}
        style={[styles.chip, verifiedOnly && styles.verifiedOn]}
      >
        <Icon name="checkmark-circle" size={14} color="#3B82F6" />
        <Text style={styles.label}>{t('home.verified')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  activeOn: {
    borderColor: colors.success,
  },
  verifiedOn: {
    borderColor: homeAccent.cyan,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
});
