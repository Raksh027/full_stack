import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { colors } from '@/theme';

type Props = PropsWithChildren<{
  radius?: number;
  /** Border thickness in px. */
  thickness?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  colors?: readonly string[];
}>;

/**
 * Gradient ring around a filled child.
 * Same technique as the DOB / GradientSelectField border —
 * LinearGradient padding with a filled inner view.
 */
export function GradientOutline({
  children,
  radius = 999,
  thickness = 1.5,
  style,
  innerStyle,
  colors: gradientColors = colors.gradientBorder,
}: Props) {
  const innerRadius = Math.max(radius - thickness, 0);

  return (
    <LinearGradient
      colors={[...gradientColors]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[
        styles.border,
        { borderRadius: radius, padding: thickness },
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          { borderRadius: innerRadius },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  border: {},
  inner: {
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
});
