import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, scale, screen } from '@/theme';

type Props = PropsWithChildren<{
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}>;

const SIZE = screen.isTablet ? scale(70) : scale(52);

export function SocialButton({
  accessibilityLabel,
  onPress,
  disabled,
  children,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        (disabled || pressed) && styles.dimmed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: colors.inputLightBorder,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.buttonPrimary,
    marginHorizontal: scale(8),
  },
  dimmed: {
    opacity: 0.5,
  },
});
