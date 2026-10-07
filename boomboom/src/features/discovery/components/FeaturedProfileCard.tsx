import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type { DiscoveryCandidate } from '@/features/discovery/types';
import { Icon } from '@/shared/components';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { colors, fontSize, palette, screen } from '@/theme';

import { LikeHeartButton } from './LikeHeartButton';
import { homeAccent } from '../theme';

type Props = {
  profile: DiscoveryCandidate;
  liked: boolean;
  onPress: () => void;
  onLike: () => void;
};

const CARD_WIDTH = screen.width * 0.78;

export function FeaturedProfileCard({
  profile,
  liked,
  onPress,
  onLike,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const photo = profile.photos?.[0]?.url;
  const flag = profileFlagUrl(profile);
  const goalKey = profile.relationshipGoal
    ? `profileOptions.relationshipGoal.${profile.relationshipGoal}.title`
    : null;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onPress}>
        <ImageBackground
          source={photo ? { uri: photo } : undefined}
          style={styles.card}
          imageStyle={styles.image}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent']}
            style={styles.topFade}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={styles.bottomFade}
          />
          <View style={styles.top}>
            <View style={styles.metaCol}>
              {profile.country || flag ? (
                <View style={styles.metaRow}>
                  {flag ? (
                    <Image source={{ uri: flag }} style={styles.flagImage} />
                  ) : null}
                  <Text style={styles.metaText}>
                    {profile.country ?? profile.city}
                  </Text>
                </View>
              ) : null}
              {profile.isOnline ? (
                <View style={styles.metaRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.metaText}>{t('home.online')}</Text>
                </View>
              ) : null}
            </View>
            <LikeHeartButton
              liked={liked}
              onPress={onLike}
              style={styles.heartBtn}
            />
          </View>

          <View style={styles.bottom}>
            <View style={styles.metaRow}>
              <Icon name="location" size={13} color={colors.textPrimary} />
              <Text style={styles.metaText}>
                {t('home.distanceAway', {
                  distance: profile.distanceKm ?? 19.8,
                })}
              </Text>
            </View>
            {goalKey ? (
              <View style={styles.metaRow}>
                <Icon name="heart" size={13} color={colors.textPrimary} />
                <Text style={styles.metaText}>{t(goalKey)}</Text>
              </View>
            ) : null}
          </View>
        </ImageBackground>
      </Pressable>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('home.sendMessage')}
          placeholderTextColor={palette.gray400}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={styles.send}
        >
          <Icon name="send" size={16} color={palette.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: CARD_WIDTH,
    gap: 10,
  },
  card: {
    height: 360,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: palette.gray850,
    justifyContent: 'space-between',
    padding: 16,
  },
  image: {
    borderRadius: 28,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metaCol: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flag: {
    fontSize: 12,
  },
  flagImage: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  metaText: {
    color: colors.textPrimary,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  heartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20,20,20,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
    paddingLeft: 16,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    paddingVertical: 0,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: homeAccent.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
