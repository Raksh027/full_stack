import { useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  FlatList,
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Photo } from '@/shared/types/api';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette, screen } from '@/theme';

type Props = {
  visible: boolean;
  photos: Photo[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function ZoomableImage({ uri, active }: { uri: string; active: boolean }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    }
  }, [active, savedScale, savedX, savedY, scale, translateX, translateY]);

  const pinch = Gesture.Pinch()
    .onUpdate(event => {
      'worklet';
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * event.scale),
      );
    })
    .onEnd(() => {
      'worklet';
      if (scale.value <= 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  // Only steal the pan when zoomed — otherwise FlatList can swipe pages
  const pan = Gesture.Pan()
    .averageTouches(true)
    .manualActivation(true)
    .onTouchesMove((_, state) => {
      'worklet';
      if (savedScale.value > 1.05 || scale.value > 1.05) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onUpdate(event => {
      'worklet';
      translateX.value = savedX.value + event.translationX;
      translateY.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      'worklet';
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      if (scale.value > 1.1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(2.2);
        savedScale.value = 2.2;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={styles.page}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, imageStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

export function PhotoLightbox({
  visible,
  photos,
  index,
  onClose,
  onChange,
}: Props) {
  const listRef = useRef<FlatList<Photo>>(null);
  const sorted = [...photos].sort((a, b) => a.position - b.position);
  const openingIndex = useRef(index);

  useEffect(() => {
    if (visible) {
      openingIndex.current = index;
    }
  }, [visible, index]);

  useEffect(() => {
    if (!visible || sorted.length === 0) {
      return;
    }
    const target = Math.min(
      Math.max(openingIndex.current, 0),
      sorted.length - 1,
    );
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: target, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [visible, sorted.length]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(
        event.nativeEvent.contentOffset.x / screen.width,
      );
      if (next >= 0 && next < sorted.length && next !== index) {
        onChange(next);
      }
    },
    [index, onChange, sorted.length],
  );

  const renderItem = useCallback(
    ({ item, index: itemIndex }: ListRenderItemInfo<Photo>) => (
      <ZoomableImage uri={item.url} active={itemIndex === index && visible} />
    ),
    [index, visible],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}
          onPress={onClose}
        >
          <Icon name="close" size={22} color={palette.white} />
        </Pressable>

        <FlatList
          ref={listRef}
          data={sorted}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          bounces={false}
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(index, Math.max(0, sorted.length - 1))}
          getItemLayout={(_, itemIndex) => ({
            length: screen.width,
            offset: screen.width * itemIndex,
            index: itemIndex,
          })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={renderItem}
          windowSize={3}
          onScrollToIndexFailed={info => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 100);
          }}
        />

        <View style={styles.footer} pointerEvents="none">
          <View style={styles.dots}>
            {sorted.map((item, itemIndex) => (
              <View
                key={item.id}
                style={[styles.dot, itemIndex === index && styles.dotActive]}
              />
            ))}
          </View>
          <Text style={styles.count}>
            {sorted.length === 0 ? '0/0' : `${index + 1}/${sorted.length}`}
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.black,
  },
  close: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30,30,30,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: {
    width: screen.width,
    height: screen.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: screen.width,
    height: screen.height * 0.78,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.gray650,
  },
  dotActive: {
    width: 16,
    backgroundColor: '#F5C400',
  },
  count: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
});
