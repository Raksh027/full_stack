import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { colors, screen } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/** Full-width call to action pinned to the bottom of the screen. */
export function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <LinearGradient
        colors={[...colors.gradientBorder]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isDisabled, busy: loading }}
          onPress={onPress}
          disabled={isDisabled}
          style={({ pressed }) => [
            styles.button,
            isDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.label}>{label}</Text>
          )}
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Platform.OS === 'ios' ? 30 : 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  gradientBorder: {
    padding: 2,
    borderRadius: 32,
  },
  button: {
    backgroundColor: colors.background,
    width: screen.width - 44,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: '#555555aa',
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
