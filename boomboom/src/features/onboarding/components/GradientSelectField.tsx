import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize } from '@/theme';

type Props = {
  leftIcon: IconName;
  value?: string;
  placeholder: string;
  onPress: () => void;
  valid?: boolean;
};

export function GradientSelectField({
  leftIcon,
  value,
  placeholder,
  onPress,
  valid = false,
}: Props) {
  const field = (
    <View style={styles.field}>
      <Icon name={leftIcon} size={18} color={colors.textMuted} />
      <Text
        style={[styles.value, !value && styles.placeholder]}
        numberOfLines={1}
      >
        {value ?? placeholder}
      </Text>
      {valid ? (
        <Icon name="checkmark-circle" size={20} color={colors.success} />
      ) : null}
      <Icon name="chevron-down" size={16} color={colors.textMuted} />
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <LinearGradient
        colors={[...colors.gradientBorder]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.border}
      >
        {field}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  border: {
    borderRadius: 16,
    padding: 1.5,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14.5,
    backgroundColor: '#101010',
    gap: 10,
  },
  value: {
    flex: 1,
    fontSize: fontSize(15),
    color: colors.textPrimary,
    fontWeight: '600',
  },
  placeholder: {
    color: colors.textDisabled,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.82,
  },
});
