import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/shared/components';
import { colors } from '@/theme';

type Props = {
  liked: boolean;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const BURSTS = [
  { x: -16, y: -28, delay: 0, rotate: -18 },
  { x: 2, y: -36, delay: 40, rotate: 8 },
  { x: 16, y: -26, delay: 70, rotate: 20 },
];

export function LikeHeartButton({ liked, onPress, size = 18, style }: Props) {
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);

  const play = () => {
    scale.value = withSequence(
      withSpring(1.45, { damping: 3, stiffness: 280 }),
      withSpring(0.92, { damping: 8, stiffness: 240 }),
      withSpring(1.12, { damping: 10, stiffness: 220 }),
      withSpring(1),
    );
    burst.value = 0;
    burst.value = withTiming(1, { duration: 620 });
    onPress();
  };

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={play}
      style={[styles.hit, style]}
    >
      <Animated.View style={heartStyle}>
        <Icon
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? colors.accent : colors.textPrimary}
        />
      </Animated.View>
      {BURSTS.map((item, index) => (
        <BurstHeart key={index} progress={burst} {...item} />
      ))}
    </Pressable>
  );
}

function BurstHeart({
  progress,
  x,
  y,
  rotate,
}: {
  progress: SharedValue<number>;
  x: number;
  y: number;
  rotate: number;
  delay?: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.15, 0.75, 1], [0, 1, 0.7, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: x * p },
        { translateY: y * p },
        { scale: interpolate(p, [0, 0.35, 1], [0.3, 1.1, 0.6], Extrapolation.CLAMP) },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.burst, style]}>
      <Icon name="heart" size={11} color={colors.accent} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  burst: {
    position: 'absolute',
  },
});
