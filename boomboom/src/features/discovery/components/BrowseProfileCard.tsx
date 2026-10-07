import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type { DiscoveryCandidate } from '@/features/discovery/types';
import type { RelationshipGoal } from '@/features/profile/types';
import { Icon, type IconName } from '@/shared/components';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { colors, fontSize, palette } from '@/theme';

import { LikeHeartButton } from './LikeHeartButton';

type Props = {
  profile: DiscoveryCandidate;
  width: number;
  liked: boolean;
  onPress: () => void;
  onLike: () => void;
};

const FLAG_SIZE = 16;

const GOAL_ICON: Partial<Record<RelationshipGoal, IconName>> = {
  new_friends: 'people-outline',
  casual: 'wine-outline',
  short_term: 'wine-outline',
  serious_love: 'heart-outline',
  marriage: 'heart',
  long_term: 'heart-outline',
  travel_partner: 'airplane-outline',
  mutual_support: 'people-outline',
  freelance: 'briefcase-outline',
};

const GOAL_SHORT: Partial<Record<RelationshipGoal, string>> = {
  casual: 'Casual',
  new_friends: 'Friendship',
  short_term: 'Casual',
  serious_love: 'Love',
  marriage: 'Marriage',
  long_term: 'Long term',
  travel_partner: 'Travel',
  mutual_support: 'Support',
  freelance: 'Freelance',
};

function formatDistance(km: number | null, fallback: string) {
  if (km == null) {
    return fallback;
  }
  if (km < 1) {
    return `${Math.max(100, Math.round(km * 1000))}m away`;
  }
  return `${Math.round(km)}km away`;
}

export function BrowseProfileCard({
  profile,
  width,
  liked,
  onPress,
  onLike,
}: Props) {
  const { t } = useTranslation();
  const photo = profile.photos?.[0]?.url;
  const height = width * 1.42;
  const place = profile.city || profile.country || t('home.defaultCity');
  const goal = profile.relationshipGoal;
  const goalLabel = goal ? GOAL_SHORT[goal] ?? null : null;
  const goalIcon = goal ? GOAL_ICON[goal] ?? 'heart-outline' : 'heart-outline';
  const flag = profileFlagUrl(profile);

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
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0.35, 0.7, 1]}
        style={styles.fade}
      />

      <View style={styles.topRow}>
        {profile.isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newText}>{t('browse.new')}</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.heartWrap}>
          <LikeHeartButton liked={liked} onPress={onLike} size={16} />
        </View>
      </View>

      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}, {profile.age}
          </Text>
          {profile.isVerified ? (
            <View style={styles.verified}>
              <Icon name="checkmark" size={10} color={palette.white} />
            </View>
          ) : null}
        </View>

        <View style={styles.placeRow}>
          {flag ? (
            <View style={styles.flagCircle}>
              <Image
                source={{ uri: flag }}
                style={styles.flagImage}
                resizeMode="cover"
              />
            </View>
          ) : null}
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
          <Icon name="location" size={11} color="#3AA0FF" />
          <Text style={styles.distance} numberOfLines={1}>
            {formatDistance(profile.distanceKm, t('browse.distanceFallback'))}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.activeRow}>
            <View
              style={[
                styles.activeDot,
                profile.isOnline ? styles.onlineDot : styles.awayDot,
              ]}
            />
            <Text style={styles.activeText}>
              {profile.isOnline ? t('browse.activeNow') : t('browse.activeRecent')}
            </Text>
          </View>
          {goalLabel ? (
            <View style={styles.goalPill}>
              <Icon name={goalIcon} size={11} color={palette.white} />
              <Text style={styles.goalText} numberOfLines={1}>
                {goalLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: palette.gray900,
  },
  photo: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.gray750,
  },
  fade: {
    ...StyleSheet.absoluteFill,
  },
  topRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  newText: {
    color: palette.white,
    fontSize: fontSize(10),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heartWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  verified: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2F80FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flagCircle: {
    width: FLAG_SIZE,
    height: FLAG_SIZE,
    borderRadius: FLAG_SIZE / 2,
    borderWidth: 1,
    borderColor: palette.gray500,
    overflow: 'hidden',
    backgroundColor: palette.gray850,
  },
  flagImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.45 }],
  },
  place: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  distance: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  bottomRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  onlineDot: {
    backgroundColor: '#22F0A0',
  },
  awayDot: {
    backgroundColor: '#22F0A0',
    opacity: 0.55,
  },
  activeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '52%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  goalText: {
    color: palette.white,
    fontSize: fontSize(10),
    fontWeight: '700',
  },
});
