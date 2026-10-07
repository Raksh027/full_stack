import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ORIENTATION_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { SexualOrientation } from '@/features/profile/types';
import { colors, fontSize, palette } from '@/theme';

const PILL_BLUE = '#3AA0FF';

type Props = {
  value: SexualOrientation | null;
  onChange: (value: SexualOrientation) => void;
};

export function OrientationPanel({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {ORIENTATION_OPTIONS.map(option => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cardTitle}>
                {t(`profileOptions.orientation.${option.value}.title`)}
              </Text>
              <Text style={styles.cardDesc}>
                {t(`profileOptions.orientation.${option.value}.description`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: palette.gray750,
    gap: 6,
  },
  cardOn: {
    borderColor: PILL_BLUE,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.85,
  },
});
