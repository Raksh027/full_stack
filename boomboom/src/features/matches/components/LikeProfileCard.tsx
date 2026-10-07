import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Icon } from '@/shared/components';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { fontSize, palette } from '@/theme';

import type { LikeProfile } from '../types';

type Props = {
  profile: LikeProfile;
  width: number;
  showActions?: boolean;
  isMatch?: boolean;
  isLikedYou?: boolean;
  isViewed?: boolean;
  onPress: () => void;
  onLike?: () => void;
  onPass?: () => void;
};

export function LikeProfileCard({
  profile,
  width,
  showActions = false,
  isMatch = false,
  isLikedYou = false,
  isViewed = false,
  onPress,
  onLike,
  onPass,
}: Props) {
  const { t } = useTranslation();
  const photo = profile.photos?.[0]?.url;
  const flag = profileFlagUrl(profile);
  const cardHeight = width * 1.38;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { width, height: cardHeight }]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View style={styles.fallback} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.92)']}
        locations={[0.4, 0.7, 1]}
        style={styles.fade}
      />

      {isMatch ? (
        <View style={styles.matchBadge}>
          <Text style={styles.matchBadgeText}>{t('likes.matchBadge')}</Text>
        </View>
      ) : null}

      {isLikedYou ? (
        <View style={styles.likedYouBadge}>
          <Icon name="heart" size={14} color={palette.white} />
        </View>
      ) : null}

      {isViewed ? (
        <View style={styles.viewedBadge}>
          <Icon name="eye" size={14} color={palette.white} />
        </View>
      ) : null}

      <View style={styles.meta}>
        <View style={styles.nameRow}>
          {flag ? (
            <Image
              source={{ uri: flag }}
              style={styles.flag}
              resizeMode="cover"
            />
          ) : null}
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}, {profile.age}
          </Text>
        </View>

        {profile.city || profile.distanceKm != null ? (
          <View style={styles.cityRow}>
            <Icon name="location" size={13} color={palette.white} />
            <Text style={styles.city} numberOfLines={1}>
              {[
                profile.city,
                profile.distanceKm != null
                  ? t('home.distanceKm', { distance: profile.distanceKm })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}

        {showActions ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('boom.nope')}
              onPress={onPass}
              style={styles.passBtn}
            >
              <Icon name="close" size={24} color="#FF3B30" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('boom.like')}
              onPress={onLike}
              style={styles.likeBtn}
            >
              <Icon name="heart" size={22} color="#30D158" />
            </Pressable>
          </View>
        ) : null}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  fallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.gray750,
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  matchBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
  },
  matchBadgeText: {
    color: palette.white,
    fontSize: fontSize(11),
    fontWeight: '800',
  },
  likedYouBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF2D55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 12,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flag: {
    width: 22,
    height: 16,
    borderRadius: 3,
  },
  name: {
    flex: 1,
    color: palette.white,
    fontSize: fontSize(14),
    fontWeight: '800',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  city: {
    flex: 1,
    color: 'rgba(255,255,255,0.88)',
    fontSize: fontSize(11),
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
  },
  passBtn: {
    width: 64,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBtn: {
    width: 64,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
