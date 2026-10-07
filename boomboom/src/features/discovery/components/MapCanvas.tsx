import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, fontSize, screen } from '@/theme';

import { homeAccent } from '../theme';
import {
  getMapTiles,
  MAP_COLS,
  MAP_ROWS,
  radiusRingSize,
  YOU_POSITION,
} from '../utils/mapPins';

const TILES = getMapTiles();
const TILE_SIZE = Math.ceil(
  Math.max(screen.width / MAP_COLS, screen.height / MAP_ROWS),
);

type Props = {
  radiusKm: number;
};

export function MapCanvas({ radiusKm }: Props) {
  const { t } = useTranslation();
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600 }), -1, true);
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.72 + pulse.value * 0.28 }],
    opacity: 0.5 - pulse.value * 0.25,
  }));

  const range = radiusRingSize(radiusKm, TILE_SIZE);

  return (
    <View style={styles.root} pointerEvents="none">
      <View
        style={[
          styles.grid,
          { width: TILE_SIZE * MAP_COLS, height: TILE_SIZE * MAP_ROWS },
        ]}
      >
        {TILES.map(tile => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={{
              position: 'absolute',
              left: tile.col * TILE_SIZE,
              top: tile.row * TILE_SIZE,
              width: TILE_SIZE,
              height: TILE_SIZE,
            }}
          />
        ))}
      </View>

      <View
        style={[
          styles.range,
          {
            width: range,
            height: range,
            left: `${YOU_POSITION.left * 100}%`,
            top: `${YOU_POSITION.top * 100}%`,
            marginLeft: -range / 2,
            marginTop: -range / 2,
          },
        ]}
      />

      <View
        style={[
          styles.youWrap,
          {
            left: `${YOU_POSITION.left * 100}%`,
            top: `${YOU_POSITION.top * 100}%`,
          },
        ]}
      >
        <Animated.View style={[styles.pulse, ringStyle]} />
        <View style={styles.youRing}>
          <View style={styles.youDot} />
        </View>
        <Text style={styles.youLabel}>{t('nearby.you')}</Text>
      </View>

      <Text style={styles.credit}>{t('nearby.attribution')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0B1014',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  range: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(46, 230, 214, 0.28)',
    backgroundColor: 'rgba(46, 230, 214, 0.05)',
  },
  youWrap: {
    position: 'absolute',
    width: 88,
    height: 88,
    marginLeft: -44,
    marginTop: -44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: homeAccent.cyan,
  },
  youRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: colors.textPrimary,
    backgroundColor: homeAccent.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0B1014',
  },
  youLabel: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: fontSize(10),
    fontWeight: '800',
  },
  credit: {
    position: 'absolute',
    right: 10,
    bottom: 118,
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize(9),
    fontWeight: '600',
  },
});
