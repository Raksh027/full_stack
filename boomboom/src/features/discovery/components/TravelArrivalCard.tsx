import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import {
  TRAVEL_TRIP_META,
  type TravelArrival,
} from '../data/mockTravelArrivals';
import { flagUrl } from '../data/journeyLocations';

type Props = {
  arrival: TravelArrival;
  width: number;
  liked: boolean;
  onPress: () => void;
  onToggleLike: () => void;
};

export function TravelArrivalCard({
  arrival,
  width,
  liked,
  onPress,
  onToggleLike,
}: Props) {
  const { t } = useTranslation();
  const height = width * 1.42;
  const trip = TRAVEL_TRIP_META[arrival.tripType] ?? TRAVEL_TRIP_META.vacation;
  const showStatus = arrival.showStatus === true;
  const photo =
    arrival.photo && !arrival.photo.includes('example.com')
      ? arrival.photo
      : arrival.coverPhoto;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { width, height }]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoFallback]} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0.35, 0.7, 1]}
        style={styles.fade}
      />

      {showStatus ? (
        <View style={styles.status}>
          <Icon name="checkmark" size={10} color={palette.white} />
          <Text style={styles.statusText}>{arrival.status}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        onPress={onToggleLike}
        style={styles.heart}
      >
        <Icon
          name={liked ? 'heart' : 'heart-outline'}
          size={20}
          color={liked ? '#FF5864' : palette.white}
        />
      </Pressable>

      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {arrival.name}, {arrival.age}
          </Text>
          {arrival.isVerified ? (
            <Icon name="checkmark-circle" size={14} color="#3AA0FF" />
          ) : null}
          {arrival.flagUrl || arrival.fromCountryFlag || arrival.flagCode ? (
            <Image
              source={{
                uri:
                  arrival.flagUrl ||
                  arrival.fromCountryFlag ||
                  flagUrl(arrival.flagCode),
              }}
              style={styles.flagImage}
              resizeMode="cover"
            />
          ) : arrival.flag ? (
            <Text style={styles.flag}>{arrival.flag}</Text>
          ) : null}
        </View>
        <View style={styles.route}>
          <Icon name="location" size={11} color={palette.white} />
          <Text style={styles.routeText} numberOfLines={1}>
            {arrival.from} → {arrival.to}
          </Text>
        </View>
        <View style={[styles.tag, { backgroundColor: trip.color }]}>
          <Icon name={trip.icon} size={11} color={palette.white} />
          <Text style={styles.tagText}>{t(trip.labelKey)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: palette.gray900,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    backgroundColor: '#1F2A44',
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
  },
  status: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#16A34A',
  },
  statusText: {
    color: palette.white,
    fontSize: fontSize(10),
    fontWeight: '700',
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  flag: {
    fontSize: fontSize(13),
  },
  flagImage: {
    width: 18,
    height: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  routeText: {
    flex: 1,
    color: 'rgba(255,255,255,0.88)',
    fontSize: fontSize(10),
    fontWeight: '500',
  },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    color: palette.white,
    fontSize: fontSize(10),
    fontWeight: '700',
  },
});
