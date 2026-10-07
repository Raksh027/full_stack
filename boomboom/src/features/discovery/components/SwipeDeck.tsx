import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { DiscoveryCandidate, SwipeAction } from '@/features/discovery/types';
import { Icon } from '@/shared/components';
import { fontSize, screen } from '@/theme';

import { SwipeProfileCard } from './SwipeProfileCard';

const THRESHOLD = 90;
const EXIT = Math.max(screen.width, screen.height) * 1.2;
const LIKE_GREEN = '#30D158';
const NOPE_RED = '#FF453A';

type Props = {
  current: DiscoveryCandidate;
  next?: DiscoveryCandidate;
  photoIndex: number;
  onSelectPhoto: (index: number) => void;
  onMessage: () => void;
  onMore: () => void;
  onOpenPhoto: (index: number) => void;
  onSwipe: (action: SwipeAction) => void;
};

export function SwipeDeck({
  current,
  next,
  photoIndex,
  onSelectPhoto,
  onMessage,
  onMore,
  onOpenPhoto,
  onSwipe,
}: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [current.id, translateX, translateY]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onUpdate(event => {
          translateX.value = event.translationX;
          translateY.value = event.translationY * 0.35;
        })
        .onEnd(event => {
          const ax = Math.abs(event.translationX);
          if (ax < THRESHOLD) {
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            return;
          }

          const like = event.translationX > 0;
          translateX.value = withTiming(like ? EXIT : -EXIT, { duration: 220 });
          translateY.value = withTiming(
            event.translationY,
            { duration: 220 },
            done => {
              if (done) {
                runOnJS(onSwipe)(like ? 'like' : 'pass');
              }
            },
          );
        }),
    [onSwipe, translateX, translateY],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-screen.width, 0, screen.width],
          [-10, 0, 10],
        )}deg`,
      },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => {
    const progress = Math.max(
      interpolate(
        translateX.value,
        [20, 120],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      interpolate(
        translateY.value,
        [-20, -120],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    );
    return {
      opacity: progress,
      transform: [
        { scale: interpolate(progress, [0, 1], [0.82, 1], Extrapolation.CLAMP) },
        { rotate: '-14deg' },
      ],
    };
  });

  const nopeStyle = useAnimatedStyle(() => {
    const progress = Math.max(
      interpolate(
        translateX.value,
        [-20, -120],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      interpolate(
        translateY.value,
        [20, 120],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    );
    return {
      opacity: progress,
      transform: [
        { scale: interpolate(progress, [0, 1], [0.82, 1], Extrapolation.CLAMP) },
        { rotate: '14deg' },
      ],
    };
  });

  return (
    <View style={styles.deck}>
      {next ? (
        <View style={styles.backCard} pointerEvents="none">
          <SwipeProfileCard
            profile={next}
            photoIndex={0}
            onSelectPhoto={() => undefined}
            onMessage={() => undefined}
            onMore={() => undefined}
            onOpenPhoto={() => undefined}
          />
        </View>
      ) : null}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.frontCard, cardStyle]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.like, likeStyle]}
          >
            <View style={[styles.stampInner, styles.likeInner]}>
              <Icon name="heart" size={18} color={LIKE_GREEN} />
              <Animated.Text style={styles.likeText}>LIKE</Animated.Text>
            </View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.nope, nopeStyle]}
          >
            <View style={[styles.stampInner, styles.nopeInner]}>
              <Icon name="close" size={20} color={NOPE_RED} />
              <Animated.Text style={styles.nopeText}>NOPE</Animated.Text>
            </View>
          </Animated.View>
          <SwipeProfileCard
            profile={current}
            photoIndex={photoIndex}
            onSelectPhoto={onSelectPhoto}
            onMessage={onMessage}
            onMore={onMore}
            onOpenPhoto={onOpenPhoto}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    flex: 1,
  },
  backCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.55,
    transform: [{ scale: 0.97 }],
  },
  frontCard: {
    flex: 1,
  },
  stamp: {
    position: 'absolute',
    top: 68,
    zIndex: 4,
  },
  stampInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2.5,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  like: {
    left: 22,
  },
  nope: {
    right: 22,
  },
  likeInner: {
    borderColor: LIKE_GREEN,
    backgroundColor: 'rgba(48, 209, 88, 0.18)',
    shadowColor: LIKE_GREEN,
  },
  nopeInner: {
    borderColor: NOPE_RED,
    backgroundColor: 'rgba(255, 69, 58, 0.18)',
    shadowColor: NOPE_RED,
  },
  likeText: {
    color: LIKE_GREEN,
    fontSize: fontSize(20),
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  nopeText: {
    color: NOPE_RED,
    fontSize: fontSize(20),
    fontWeight: '900',
    letterSpacing: 2.5,
  },
});
