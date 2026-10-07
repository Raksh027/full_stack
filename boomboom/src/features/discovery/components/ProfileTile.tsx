import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type { DiscoveryCandidate } from '@/features/discovery/types';
import { Icon } from '@/shared/components';
import { asNullableNumber } from '@/shared/utils/safeValue';
import { colors, fontSize, palette } from '@/theme';

type Props = {
  profile: DiscoveryCandidate;
  width: number;
  onPress: () => void;
};

function formatDistance(km: number | null) {
  const value = asNullableNumber(km);
  if (value == null) {
    return null;
  }
  if (value < 1) {
    return `${Math.max(100, Math.round(value * 1000))} m`;
  }
  return `${value.toFixed(1)} km`;
}

export function ProfileTile({ profile, width, onPress }: Props) {
  const { t } = useTranslation();
  const photo = profile.photos?.[0]?.url;
  const height = width * 1.35;
  const distance = formatDistance(profile.distanceKm);
  const offlineRecent =
    profile.id.charCodeAt(profile.id.length - 1) % 2 === 0;
  const statusLabel = profile.isOnline
    ? t('home.online')
    : offlineRecent
      ? t('home.activeMinutes', { minutes: 50 })
      : t('home.activeHour');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { width, height }]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View style={styles.fallback} />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.fade}
      />

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.name}, {profile.age}
        </Text>
        <View style={styles.row}>
          <View style={styles.status}>
            {profile.isOnline ? (
              <View style={[styles.statusDot, styles.onlineDot]} />
            ) : null}
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          {distance ? (
            <View style={styles.distance}>
              <Icon name="location" size={10} color="#3AA0FF" />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: palette.gray900,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.gray750,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
  },
  meta: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 8,
    gap: 2,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineDot: {
    backgroundColor: '#22C55E',
  },
  statusText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: fontSize(9),
    fontWeight: '500',
  },
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  distanceText: {
    color: palette.white,
    fontSize: fontSize(9),
    fontWeight: '600',
  },
});
