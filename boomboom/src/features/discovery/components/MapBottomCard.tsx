import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { images } from '@/assets';
import { Icon } from '@/shared/components';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { colors, fontSize, palette } from '@/theme';

import type { DiscoveryCandidate } from '../types';
import { formatMapDistance } from '../utils/mapCardKind';

type Props = {
  profile: DiscoveryCandidate;
  width: number;
  selected?: boolean;
  onPress: () => void;
};

export function MapBottomCard({
  profile,
  width,
  selected,
  onPress,
}: Props) {
  const photo = profile.photos?.[0]?.url;
  const distance = formatMapDistance(profile.distanceKm);
  const flag = profileFlagUrl(profile);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { width }, selected && styles.cardSelected]}
    >
      <View style={[styles.photoWrap, { width, height: width }]}>
        <Image
          source={photo ? { uri: photo } : images.profilePlaceholder}
          style={styles.photo}
        />
        {profile.isOnline ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.meta}>
        <View style={styles.nameRow}>
          {flag ? (
            <Image source={{ uri: flag }} style={styles.flag} />
          ) : null}
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
        </View>
        <View style={styles.distanceRow}>
          <Icon name="location" size={11} color="#EF4444" />
          <Text style={styles.distance} numberOfLines={1}>
            {distance}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
  },
  cardSelected: {
    opacity: 0.92,
  },
  photoWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: palette.gray850,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  onlineDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#0B0B0B',
  },
  meta: {
    gap: 3,
    paddingHorizontal: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  flag: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.gray750,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distance: {
    color: colors.textPrimary,
    fontSize: fontSize(11),
    fontWeight: '600',
  },
});
