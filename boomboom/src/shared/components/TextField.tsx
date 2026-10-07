import type { ReactNode, Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fontSize, moderateScale, scale, verticalScale } from '@/theme';

import { GradientOutline } from './GradientOutline';
import { Icon, type IconName } from './Icon';

type Props = TextInputProps & {
  /** `light` is the white pill used on auth screens; `dark` is the labelled field used in onboarding. */
  variant?: 'light' | 'dark' | 'gradient';
  label?: string;
  error?: string;
  leftIcon?: IconName;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextInputInstance>;
};

export function TextField({
  variant = 'light',
  label,
  error,
  leftIcon,
  right,
  containerStyle,
  style,
  ref,
  multiline,
  ...inputProps
}: Props) {
  const isDark = variant === 'dark';
  const isGradient = variant === 'gradient';
  const placeholderColor =
    isGradient || isDark ? colors.textDisabled : colors.placeholder;
  const isMultiline = Boolean(multiline);

  const field = (
    <View
      style={[
        isGradient
          ? styles.gradientField
          : isDark
          ? styles.darkField
          : styles.lightField,
        isMultiline && styles.multilineField,
        error && !isGradient ? styles.fieldError : null,
      ]}
    >
      {leftIcon ? (
        <View style={isMultiline ? styles.multilineIcon : undefined}>
          <Icon name={leftIcon} size={20} color={colors.textMuted} />
        </View>
      ) : null}
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={placeholderColor}
        textAlignVertical={isMultiline ? 'top' : inputProps.textAlignVertical}
        style={[
          isGradient
            ? styles.gradientInput
            : isDark
            ? styles.darkInput
            : styles.lightInput,
          isMultiline && styles.multilineInput,
          style,
        ]}
        {...inputProps}
      />
      {right}
    </View>
  );

  const outlineRadius = isMultiline ? 18 : 999;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {isGradient ? (
        error ? (
          <View
            style={[
              styles.gradientError,
              isMultiline && styles.gradientErrorMultiline,
            ]}
          >
            {field}
          </View>
        ) : (
          <GradientOutline radius={outlineRadius}>{field}</GradientOutline>
        )
      ) : (
        field
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lightField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: verticalScale(52),
    borderWidth: 1,
    borderColor: colors.inputLightBorder,
    borderRadius: moderateScale(24),
    paddingHorizontal: scale(16),
    backgroundColor: colors.inputLightBackground,
    gap: 10,
  },
  lightInput: {
    flex: 1,
    height: '100%',
    fontSize: fontSize(15),
    color: colors.inputLightText,
  },
  darkField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  darkInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  gradientField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceMuted,
    gap: 10,
  },
  gradientInput: {
    flex: 1,
    fontSize: fontSize(15),
    color: colors.textPrimary,
    padding: 0,
  },
  gradientError: {
    borderWidth: 1.5,
    borderColor: '#FF6B6B',
    borderRadius: 999,
    overflow: 'hidden',
  },
  gradientErrorMultiline: {
    borderRadius: 18,
  },
  multilineField: {
    alignItems: 'flex-start',
    minHeight: 96,
    paddingVertical: 14,
  },
  multilineIcon: {
    paddingTop: 2,
  },
  multilineInput: {
    minHeight: 68,
    paddingTop: 0,
    lineHeight: 22,
  },
  fieldError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: fontSize(12),
    marginLeft: scale(8),
  },
});
