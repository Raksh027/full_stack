import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  colors,
  fontSize,
  moderateScale,
  radius,
  verticalScale,
} from '@/theme';

import { Icon, type IconName } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  shape?: 'pill' | 'rounded';
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  shape = 'pill',
  style,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        shape === 'rounded' && styles.rounded,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.buttonPrimaryText} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Icon name={icon} size={20} color={colors.buttonPrimaryText} />
          ) : null}
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: verticalScale(52),
    backgroundColor: colors.buttonPrimary,
    borderRadius: moderateScale(radius.xl),
    justifyContent: 'center',
    alignItems: 'center',
  },
  rounded: {
    borderRadius: 14,
  },
  disabled: {
    backgroundColor: colors.buttonDisabled,
  },
  pressed: {
    opacity: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: colors.buttonPrimaryText,
    fontSize: fontSize(15),
    fontWeight: '600',
  },
});
