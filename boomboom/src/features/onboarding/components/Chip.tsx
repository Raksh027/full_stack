import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

const ACCENT = '#F5C400';

type Props = {
  label: string;
  icon?: IconName;
  emoji?: string;
  image?: ImageSourcePropType;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function Chip({
  label,
  icon,
  emoji,
  image,
  selected,
  onPress,
  disabled,
}: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="contain" />
        ) : emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : icon ? (
          <Icon
            name={icon}
            size={15}
            color={selected ? ACCENT : colors.textSecondary}
          />
        ) : null}
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  selected: {
    backgroundColor: '#1A1600',
    borderColor: ACCENT,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  image: {
    width: 16,
    height: 16,
  },
  emoji: {
    fontSize: fontSize(14),
    lineHeight: fontSize(18),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: fontSize(14),
    color: colors.textPrimary,
    fontWeight: '500',
  },
  labelSelected: {
    color: ACCENT,
    fontWeight: '700',
  },
});
