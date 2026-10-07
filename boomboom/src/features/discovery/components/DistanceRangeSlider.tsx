import { useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const ACCENT = '#FF2D8A';
const TRACK = '#2A1A3A';
const ACTIVE = '#FF2D8A';
const THUMB = 22;
const HIT = 36;

type Props = {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
};

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

export function DistanceRangeSlider({
  min,
  max,
  low,
  high,
  onChange,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbRef = useRef<'low' | 'high'>('low');
  const valuesRef = useRef({ low, high, trackWidth, min, max });
  valuesRef.current = { low, high, trackWidth, min, max };

  const span = max - min;
  const lowX = trackWidth > 0 ? ((low - min) / span) * trackWidth : 0;
  const highX = trackWidth > 0 ? ((high - min) / span) * trackWidth : 0;

  const applyX = (x: number) => {
    const {
      low: currentLow,
      high: currentHigh,
      trackWidth: width,
      min: rangeMin,
      max: rangeMax,
    } = valuesRef.current;
    if (width <= 0) {
      return;
    }
    const ratio = clamp(x / width, 0, 1);
    const next = Math.round(rangeMin + ratio * (rangeMax - rangeMin));
    if (thumbRef.current === 'low') {
      onChange(Math.min(next, currentHigh - 1), currentHigh);
    } else {
      onChange(currentLow, Math.max(next, currentLow + 1));
    }
  };

  const beginAt = (x: number) => {
    const { low: currentLow, high: currentHigh, trackWidth: width, min: rangeMin, max: rangeMax } =
      valuesRef.current;
    const currentSpan = rangeMax - rangeMin;
    const lx = width > 0 ? ((currentLow - rangeMin) / currentSpan) * width : 0;
    const hx = width > 0 ? ((currentHigh - rangeMin) / currentSpan) * width : 0;
    thumbRef.current = Math.abs(x - lx) <= Math.abs(x - hx) ? 'low' : 'high';
    applyX(x);
  };

  const pan = Gesture.Pan()
    .onBegin(event => {
      runOnJS(beginAt)(event.x);
    })
    .onUpdate(event => {
      runOnJS(applyX)(event.x);
    });

  const tap = Gesture.Tap().onEnd(event => {
    runOnJS(beginAt)(event.x);
  });

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        style={styles.hit}
        onLayout={(event: LayoutChangeEvent) => {
          setTrackWidth(event.nativeEvent.layout.width);
        }}
      >
        <View style={styles.track} />
        <View
          style={[
            styles.fill,
            {
              left: lowX,
              width: Math.max(0, highX - lowX),
            },
          ]}
        />
        <View style={[styles.thumb, { left: Math.max(0, lowX - THUMB / 2) }]} />
        <View style={[styles.thumb, { left: Math.max(0, highX - THUMB / 2) }]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: HIT,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: TRACK,
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: 999,
    backgroundColor: ACTIVE,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: ACCENT,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    top: (HIT - THUMB) / 2,
  },
});
