import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

const ACCENT = '#F5C400';

type Props = {
  label: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function LifestyleChoice({
  label,
  icon,
  selected,
  onPress,
  disabled,
}: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, selected && styles.iconSelected]}>
        <Icon
          name={icon ?? 'ellipse-outline'}
          size={18}
          color={selected ? palette.black : colors.textSecondary}
        />
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    flexGrow: 1,
    minHeight: 88,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: palette.gray750,
    gap: 10,
  },
  selected: {
    borderColor: ACCENT,
    backgroundColor: '#1A1600',
  },
  pressed: {
    opacity: 0.82,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: {
    backgroundColor: ACCENT,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
    lineHeight: 18,
  },
  labelSelected: {
    color: ACCENT,
  },
});
