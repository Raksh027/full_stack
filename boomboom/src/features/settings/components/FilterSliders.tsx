import { useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const ACCENT = '#7C5CFF';
const TRACK = '#2A2438';
const THUMB = 22;
const HIT = 36;

type RangeProps = {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
};

type ValueProps = {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
};

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

export function FilterRangeSlider({
  min,
  max,
  low,
  high,
  onChange,
}: RangeProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbRef = useRef<'low' | 'high'>('low');
  const valuesRef = useRef({ low, high, trackWidth, min, max });
  valuesRef.current = { low, high, trackWidth, min, max };

  const span = max - min || 1;
  const lowX = trackWidth > 0 ? ((low - min) / span) * trackWidth : 0;
  const highX = trackWidth > 0 ? ((high - min) / span) * trackWidth : 0;

  const applyX = (x: number) => {
    const state = valuesRef.current;
    if (state.trackWidth <= 0) {
      return;
    }
    const ratio = clamp(x / state.trackWidth, 0, 1);
    const next = Math.round(state.min + ratio * (state.max - state.min));
    if (thumbRef.current === 'low') {
      onChange(Math.min(next, state.high - 1), state.high);
    } else {
      onChange(state.low, Math.max(next, state.low + 1));
    }
  };

  const beginAt = (x: number) => {
    const state = valuesRef.current;
    const currentSpan = state.max - state.min || 1;
    const lx =
      state.trackWidth > 0
        ? ((state.low - state.min) / currentSpan) * state.trackWidth
        : 0;
    const hx =
      state.trackWidth > 0
        ? ((state.high - state.min) / currentSpan) * state.trackWidth
        : 0;
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
            { left: lowX, width: Math.max(0, highX - lowX) },
          ]}
        />
        <View style={[styles.thumb, { left: Math.max(0, lowX - THUMB / 2) }]} />
        <View
          style={[styles.thumb, { left: Math.max(0, highX - THUMB / 2) }]}
        />
      </View>
    </GestureDetector>
  );
}

export function FilterValueSlider({ min, max, value, onChange }: ValueProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const valuesRef = useRef({ value, trackWidth, min, max });
  valuesRef.current = { value, trackWidth, min, max };

  const span = max - min || 1;
  const x = trackWidth > 0 ? ((value - min) / span) * trackWidth : 0;

  const applyX = (pos: number) => {
    const state = valuesRef.current;
    if (state.trackWidth <= 0) {
      return;
    }
    const ratio = clamp(pos / state.trackWidth, 0, 1);
    onChange(Math.round(state.min + ratio * (state.max - state.min)));
  };

  const pan = Gesture.Pan()
    .onBegin(event => {
      runOnJS(applyX)(event.x);
    })
    .onUpdate(event => {
      runOnJS(applyX)(event.x);
    });

  const tap = Gesture.Tap().onEnd(event => {
    runOnJS(applyX)(event.x);
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
        <View style={[styles.fill, { left: 0, width: Math.max(0, x) }]} />
        <View style={[styles.thumb, { left: Math.max(0, x - THUMB / 2) }]} />
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
    backgroundColor: ACCENT,
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
