import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

type Props = {
  label: string;
  hint?: string;
  icon?: IconName;
  iconColor?: string;
  accent?: boolean;
  selected: boolean;
  onPress: () => void;
};

export function RadioOption({
  label,
  hint,
  icon,
  iconColor,
  accent = false,
  selected,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [
        styles.option,
        accent
          ? selected
            ? styles.accentOn
            : styles.accentOff
          : selected
            ? styles.selected
            : styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            iconColor ? { backgroundColor: `${iconColor}22` } : null,
          ]}
        >
          <Icon
            name={icon}
            size={18}
            color={
              iconColor ??
              (selected ? colors.textPrimary : colors.textSecondary)
            }
          />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {accent ? (
        <View style={[styles.mark, selected && styles.markOn]}>
          {selected ? <View style={styles.markDot} /> : null}
        </View>
      ) : (
        <Icon
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={selected ? colors.textPrimary : colors.textMuted}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: palette.gray950,
    borderWidth: 1,
    gap: 12,
  },
  inactive: {
    borderColor: palette.gray650,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 5,
  },
  selected: {
    backgroundColor: palette.gray850,
    borderColor: palette.gray500,
    shadowOpacity: 0,
    elevation: 0,
  },
  accentOff: {
    borderColor: '#3A3A3A',
    backgroundColor: '#101010',
    shadowOpacity: 0,
    elevation: 0,
  },
  accentOn: {
    borderColor: colors.gradientBorder[0],
    backgroundColor: '#101010',
    shadowOpacity: 0,
    elevation: 0,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#6A6A6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: {
    borderColor: '#F5C400',
    backgroundColor: 'transparent',
  },
  markDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F5C400',
  },
  pressed: {
    opacity: 0.82,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.gray850,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '500',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
});
