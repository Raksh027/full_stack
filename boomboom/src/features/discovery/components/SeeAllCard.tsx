import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { homeAccent } from '../theme';

type Props = {
  width: number;
  onPress: () => void;
  label?: string;
};

export function SeeAllCard({ width, onPress, label }: Props) {
  const { t } = useTranslation();
  const height = width * 1.35;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { width, height }]}
    >
      <View style={styles.iconRing}>
        <Icon name="arrow-forward" size={22} color={homeAccent.cyan} />
      </View>
      <Text style={styles.label}>{label ?? t('home.seeAll')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: homeAccent.card,
    borderWidth: 1,
    borderColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: homeAccent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
});
