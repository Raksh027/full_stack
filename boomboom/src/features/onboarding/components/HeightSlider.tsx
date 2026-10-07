import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { colors, fontSize, palette } from '@/theme';

const MIN_CM = 91;
const MAX_CM = 244;
const ACCENT = '#F5C400';
const THUMB = 24;
const HIT_HEIGHT = 40;

type Props = {
  valueCm: number;
  onChange: (cm: number) => void;
};

function clampCm(value: number) {
  return Math.round(Math.min(MAX_CM, Math.max(MIN_CM, value)));
}

function formatFeet(cm: number) {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (inches === 12) {
    return `${feet + 1}'0"`;
  }
  return `${feet}'${inches}"`;
}

export function HeightSlider({ valueCm, onChange }: Props) {
  const { t } = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);

  const ratio = (valueCm - MIN_CM) / (MAX_CM - MIN_CM);
  const thumbLeft = trackWidth > 0 ? ratio * trackWidth : 0;

  const setFromX = (x: number) => {
    if (trackWidth <= 0) {
      return;
    }
    const next = MIN_CM + (x / trackWidth) * (MAX_CM - MIN_CM);
    onChange(clampCm(next));
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .onBegin(event => {
      runOnJS(setFromX)(event.x);
    })
    .onUpdate(event => {
      runOnJS(setFromX)(event.x);
    });

  const tap = Gesture.Tap().onEnd(event => {
    runOnJS(setFromX)(event.x);
  });

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View>
      <View style={styles.readout}>
        <View style={styles.readoutCol}>
          <Text style={styles.readoutValue}>{formatFeet(valueCm)}</Text>
          <Text style={styles.readoutUnit}>{t('onboarding.lifestyle.feet')}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.readoutCol}>
          <Text style={styles.readoutValue}>{valueCm}</Text>
          <Text style={styles.readoutUnit}>
            {t('onboarding.lifestyle.centimeters')}
          </Text>
        </View>
      </View>

      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View
          collapsable={false}
          style={styles.sliderHit}
          onLayout={onLayout}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: Math.max(thumbLeft, 0) }]} />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              { left: Math.max(thumbLeft - THUMB / 2, -2) },
            ]}
          />
        </View>
      </GestureDetector>

      <View style={styles.range}>
        <Text style={styles.rangeText}>
          {t('onboarding.lifestyle.cmValue', { value: MIN_CM })}
        </Text>
        <Text style={styles.rangeMid}>
          {t('onboarding.lifestyle.cmValue', { value: valueCm })}
        </Text>
        <Text style={styles.rangeText}>
          {t('onboarding.lifestyle.cmValue', { value: MAX_CM })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  readoutCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  readoutValue: {
    color: colors.textPrimary,
    fontSize: fontSize(26),
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  readoutUnit: {
    color: colors.textMuted,
    fontSize: fontSize(12),
    fontWeight: '500',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: palette.gray650,
  },
  sliderHit: {
    height: HIT_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
  },
  fill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: (HIT_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: palette.white,
    borderWidth: 3,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  range: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeText: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  rangeMid: {
    color: ACCENT,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
});
