import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { colors, fontSize } from '@/theme';

type Props = {
  onPress: () => void;
  ready?: boolean;
  loading?: boolean;
  label?: string;
};

/** Shared onboarding CTA — matches the Looking For (Orientation) next button. */
export function OnboardingNextButton({
  onPress,
  ready = true,
  loading = false,
  label,
}: Props) {
  const { t } = useTranslation();
  const disabled = !ready || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && ready && styles.pressed]}
    >
      <LinearGradient
        colors={[...colors.gradientBorder]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.border}
        collapsable={false}
      >
        <View style={styles.button}>
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={[styles.label, !ready && styles.labelOff]}>
              {label ?? t('common.next')}
            </Text>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  border: {
    borderRadius: 999,
    padding: 1.5,
    overflow: 'hidden',
  },
  button: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(17),
    fontWeight: '700',
  },
  labelOff: {
    color: '#8E8E93',
  },
});
