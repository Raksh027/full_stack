import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { images } from '@/assets';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';
import { formatKm } from '@/shared/utils/safeValue';

import { homeAccent } from '../theme';
import type { DiscoveryCandidate } from '../types';
import { LikeHeartButton } from './LikeHeartButton';

type Props = {
  profile: DiscoveryCandidate;
  liked: boolean;
  onPress: () => void;
  onLike: () => void;
};

export function NearbyPreviewCard({ profile, liked, onPress, onLike }: Props) {
  const { t } = useTranslation();
  const photo = profile.photos?.[0]?.url;
  const distance =
    profile.distanceKm != null ? `${formatKm(profile.distanceKm)} km` : '—';
  const interest = profile.commonInterests?.[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('nearby.viewProfile')}
      onPress={onPress}
      style={styles.card}
    >
      <Image
        source={photo ? { uri: photo } : images.profilePlaceholder}
        style={styles.photo}
      />
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}, {profile.age}
          </Text>
          {profile.isVerified ? (
            <Icon name="checkmark-circle" size={15} color={homeAccent.cyan} />
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Icon name="location" size={12} color={homeAccent.yellow} />
          <Text style={styles.meta}>{distance}</Text>
          {profile.city ? (
            <>
              <Text style={styles.sep}>·</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {profile.city}
              </Text>
            </>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: profile.isOnline
                  ? colors.success
                  : palette.gray400,
              },
            ]}
          />
          <Text style={styles.meta}>
            {profile.isOnline ? t('home.online') : t('boom.offline')}
          </Text>
          {interest ? (
            <>
              <Text style={styles.sep}>·</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {interest}
              </Text>
            </>
          ) : null}
        </View>
        <Text style={styles.cta}>{t('nearby.viewProfile')}</Text>
      </View>
      <LikeHeartButton liked={liked} onPress={onLike} style={styles.heart} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(14,14,14,0.96)',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: palette.gray750,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize(17),
    fontWeight: '800',
    maxWidth: '86%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    fontWeight: '600',
    flexShrink: 1,
  },
  sep: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  cta: {
    marginTop: 2,
    color: homeAccent.yellow,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heart: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
