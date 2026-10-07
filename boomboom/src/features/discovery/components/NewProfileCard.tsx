import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DiscoveryCandidate } from '@/features/discovery/types';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { LikeHeartButton } from './LikeHeartButton';

type Props = {
  profile: DiscoveryCandidate;
  width: number;
  liked: boolean;
  onPress: () => void;
  onLike: () => void;
};

export function NewProfileCard({
  profile,
  width,
  liked,
  onPress,
  onLike,
}: Props) {
  const { t } = useTranslation();
  const photo = profile.photos?.[0]?.url;
  const photoHeight = width * 1.48;
  const goalKey = profile.relationshipGoal
    ? `profileOptions.relationshipGoal.${profile.relationshipGoal}.title`
    : null;
  const place = [profile.city, profile.country].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { width }]}
    >
      <View style={[styles.photoWrap, { width, height: photoHeight }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          <View style={styles.fallback} />
        )}
        <LikeHeartButton
          liked={liked}
          onPress={onLike}
          size={16}
          style={styles.heart}
        />
      </View>

      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.name}, {profile.age}
        </Text>
        {profile.isVerified ? (
          <Icon name="checkmark-circle" size={13} color="#3B82F6" />
        ) : null}
      </View>

      {place ? (
        <View style={styles.meta}>
          <Icon name="location" size={11} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {place}
          </Text>
        </View>
      ) : null}

      <View style={styles.meta}>
        {profile.isOnline ? (
          <>
            <View style={styles.onlineDot} />
            <Text style={styles.metaText}>{t('home.online')}</Text>
          </>
        ) : null}
        {goalKey ? (
          <>
            <Icon name="heart" size={11} color="#E74C3C" />
            <Text style={styles.metaText} numberOfLines={1}>
              {t(goalKey)}
            </Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
  },
  photoWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: palette.gray850,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    backgroundColor: palette.gray750,
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(10,10,10,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  metaText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: fontSize(10),
    fontWeight: '500',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
});
