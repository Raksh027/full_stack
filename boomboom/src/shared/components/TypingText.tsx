import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  text: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
};

/** Reveals the text left-to-right like it is being typed. */
export function TypingText({ text, duration = 1200, style }: Props) {
  const [textWidth, setTextWidth] = useState(0);
  const revealedWidth = useSharedValue(0);

  useEffect(() => {
    if (textWidth === 0) {
      return;
    }
    revealedWidth.value = 0;
    revealedWidth.value = withTiming(textWidth + 6, { duration });
  }, [textWidth, text, duration, revealedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: revealedWidth.value,
  }));

  return (
    <View style={styles.wrapper}>
      <Text
        style={[style, styles.measure]}
        numberOfLines={1}
        onLayout={event => setTextWidth(event.nativeEvent.layout.width)}
      >
        {text}
      </Text>
      <Animated.View style={[styles.clip, animatedStyle]}>
        <Text style={style} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
  },
  measure: {
    position: 'absolute',
    opacity: 0,
  },
  clip: {
    overflow: 'hidden',
  },
});
