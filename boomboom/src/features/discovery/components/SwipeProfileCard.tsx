import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import type { DiscoveryCandidate } from '@/features/discovery/types';
import {
  INTEREST_OPTIONS,
  LIFESTYLE_OPTIONS,
  lifestyleLabelKey,
} from '@/features/profile/constants/profileOptions';
import { Icon, type IconName } from '@/shared/components';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { colors, fontSize, palette, screen } from '@/theme';

import { LikeHeartButton } from './LikeHeartButton';
import { homeAccent } from '../theme';

const HERO_HEIGHT = Math.min(screen.height * 0.52, 460);
const ACCENT_YELLOW = homeAccent.yellow;
const ACCENT_PURPLE = homeAccent.purple;
const NAME_FLAG_SIZE = 28;
const ABOUT_PREVIEW_LINES = 3;

const INTEREST_META = Object.fromEntries(
  INTEREST_OPTIONS.map(item => [item.value, item]),
) as Record<string, (typeof INTEREST_OPTIONS)[number]>;

const PERSONALITY_EMOJI: Record<string, string> = {
  introvert: '👤',
  extrovert: '☀️',
  ambivert: '🌗',
};


type Props = {
  profile: DiscoveryCandidate;
  photoIndex: number;
  onSelectPhoto: (index: number) => void;
  onMessage: () => void;
  onMore: () => void;
  onOpenPhoto: (index: number) => void;
  showLikeButton?: boolean;
  showMessageButton?: boolean;
  showShareButton?: boolean;
  liked?: boolean;
  onLike?: () => void;
  onShare?: () => void;
};

export function SwipeProfileCard({
  profile,
  photoIndex,
  onSelectPhoto,
  onMessage,
  onMore,
  onOpenPhoto,
  showLikeButton = false,
  showMessageButton = true,
  showShareButton = false,
  liked = false,
  onLike,
  onShare,
}: Props) {
  const { t } = useTranslation();
  const photos = [...(profile.photos ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const hero = photos[photoIndex] ?? photos[0];
  const goal = profile.relationshipGoal
    ? t(`profileOptions.relationshipGoal.${profile.relationshipGoal}.title`)
    : t('boom.notSpecified');
  const location = profile.jobTitle || profile.city || t('boom.notSpecified');
  const flag = profileFlagUrl(profile);
  const scrollY = useSharedValue(0);
  const [overlayInteractive, setOverlayInteractive] = useState(true);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(true);

  useEffect(() => {
    scrollY.value = 0;
    setOverlayInteractive(true);
    setAboutExpanded(false);
  }, [profile.id, scrollY]);

  const workoutValue = profile.lifestyle.workout;
  const drinkingValue = profile.lifestyle.drinking;
  const personalityValue = profile.lifestyle.personality;

  const tapToOpen = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(onOpenPhoto)(photoIndex);
      }),
    [onOpenPhoto, photoIndex],
  );

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HERO_HEIGHT * 0.35],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollY.value = y;
    const nextInteractive = y < 24;
    if (nextInteractive !== overlayInteractive) {
      setOverlayInteractive(nextInteractive);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.heroLayer} pointerEvents="none">
        <Image
          source={hero?.url ? { uri: hero.url } : undefined}
          style={styles.hero}
          resizeMode="cover"
        />
        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,0,0,0.4)',
            'rgba(0,0,0,0.88)',
            '#000000',
          ]}
          locations={[0.3, 0.55, 0.8, 1]}
          style={styles.heroFade}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.heroSpacer} />

        <View style={styles.sheet}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gallery}
            >
              {photos.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => onSelectPhoto(index)}
                  style={[
                    styles.thumb,
                    index === photoIndex && styles.thumbActive,
                  ]}
                >
                  <Image
                    source={item.url ? { uri: item.url } : undefined}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {photos.length > 1 ? (
            <View style={styles.dots}>
              {photos.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.dot, index === photoIndex && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.aboutCard}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAboutExpanded(open => !open)}
              style={styles.sectionHeaderRow}
            >
              <Text style={styles.sectionTitle}>{t('boom.aboutMe')}</Text>
              <Icon
                name={aboutExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.white}
              />
            </Pressable>
            <Text
              style={styles.aboutBody}
              numberOfLines={aboutExpanded ? 40 : ABOUT_PREVIEW_LINES}
            >
              {profile.bio || t('boom.notSelected')}
            </Text>
          </View>

          <View style={styles.detailSection}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setInterestsExpanded(open => !open)}
              style={styles.sectionHeaderRow}
            >
              <View style={styles.sectionHeaderLeft}>
                <Icon name="star-outline" size={16} color={ACCENT_YELLOW} />
                <Text style={styles.sectionTitle}>{t('boom.interests')}</Text>
              </View>
              <Icon
                name={interestsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.white}
              />
            </Pressable>
            {interestsExpanded ? (
              profile.interests.length > 0 ? (
                <View style={styles.pillRow}>
                  {profile.interests.map(interest => {
                    const meta = INTEREST_META[interest] as
                      | { value: string; icon?: IconName }
                      | undefined;
                    const icon = meta?.icon;
                    const labelKey =
                      `profileOptions.interests.options.${interest}` as 'profileOptions.interests.options.music';
                    return (
                      <View key={interest} style={styles.infoPill}>
                        {icon ? (
                          <Icon name={icon} size={14} color={palette.white} />
                        ) : null}
                        <Text style={styles.infoPillText}>{t(labelKey)}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.sectionMuted}>{t('boom.notSelected')}</Text>
              )
            ) : null}
          </View>

          <View style={styles.detailSection}>
            <View style={styles.sectionHeaderLeft}>
              <Icon name="barbell-outline" size={16} color={ACCENT_YELLOW} />
              <Text style={styles.sectionTitle}>{t('boom.workout')}</Text>
            </View>
            {workoutValue ? (
              <View style={styles.pillRow}>
                {LIFESTYLE_OPTIONS.workout.map(option => {
                  const selected = option.value === workoutValue;
                  return (
                    <View
                      key={option.value}
                      style={[
                        styles.choicePill,
                        selected && styles.choicePillSelected,
                      ]}
                    >
                      {selected ? (
                        <View style={styles.checkBadge}>
                          <Icon name="checkmark" size={10} color={palette.black} />
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.choicePillText,
                          selected && styles.choicePillTextSelected,
                        ]}
                      >
                        {t(lifestyleLabelKey('workout', option.value))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.sectionMuted}>{t('boom.notSelected')}</Text>
            )}
          </View>

          <View style={styles.detailSection}>
            <View style={styles.sectionHeaderLeft}>
              <Icon name="person-outline" size={16} color={ACCENT_YELLOW} />
              <Text style={styles.sectionTitle}>{t('boom.personalityType')}</Text>
            </View>
            {personalityValue ? (
              <View style={styles.pillRow}>
                {LIFESTYLE_OPTIONS.personality.map(option => {
                  const selected = option.value === personalityValue;
                  return (
                    <View
                      key={option.value}
                      style={[
                        styles.infoPill,
                        selected && styles.infoPillSelected,
                      ]}
                    >
                      <Text style={styles.infoPillEmoji}>
                        {PERSONALITY_EMOJI[option.value] ?? '✨'}
                      </Text>
                      <Text style={styles.infoPillText}>
                        {t(lifestyleLabelKey('personality', option.value))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.sectionMuted}>{t('boom.notSelected')}</Text>
            )}
          </View>

          <View style={styles.detailSection}>
            <View style={styles.sectionHeaderLeft}>
              <Icon name="wine-outline" size={16} color={ACCENT_YELLOW} />
              <Text style={styles.sectionTitle}>{t('boom.drink')}</Text>
            </View>
            {drinkingValue ? (
              <View style={styles.pillRow}>
                {LIFESTYLE_OPTIONS.drinking.map(option => {
                  const selected = option.value === drinkingValue;
                  return (
                    <View
                      key={option.value}
                      style={[
                        styles.choicePill,
                        selected && styles.choicePillSelected,
                      ]}
                    >
                      {selected ? (
                        <View style={styles.checkBadge}>
                          <Icon name="checkmark" size={10} color={palette.black} />
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.choicePillText,
                          selected && styles.choicePillTextSelected,
                        ]}
                      >
                        {t(lifestyleLabelKey('drinking', option.value))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.sectionMuted}>{t('boom.notSelected')}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <Animated.View
        style={[styles.heroOverlay, overlayStyle]}
        pointerEvents={overlayInteractive ? 'box-none' : 'none'}
      >
        <GestureDetector gesture={tapToOpen}>
          <View style={styles.heroHit} collapsable={false} />
        </GestureDetector>

        <Pressable
          accessibilityRole="button"
          onPress={onMore}
          style={styles.moreBtn}
        >
          <Icon name="ellipsis-horizontal" size={18} color={palette.white} />
        </Pressable>

        <View style={styles.heroBottom} pointerEvents="box-none">
          <View style={styles.heroTopRow} pointerEvents="box-none">
            <View style={styles.heroCopy} pointerEvents="none">
              <View style={styles.nameRow}>
                {flag ? (
                  <View style={styles.nameFlagCircle}>
                    <Image
                      source={{ uri: flag }}
                      style={styles.nameFlag}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}
                <Text style={styles.name}>
                  {profile.name}
                  <Text style={styles.nameComma}>,</Text>
                  <Text
                    style={[
                      styles.age,
                      profile.gender === 'man' && styles.ageMale,
                      profile.gender === 'woman' && styles.ageFemale,
                    ]}
                  >
                    {profile.age}
                  </Text>
                </Text>
                {profile.isVerified ? (
                  <Icon
                    name="checkmark-circle"
                    size={22}
                    color="#3B82F6"
                  />
                ) : null}
              </View>
              <View style={styles.jobRow}>
                <Icon
                  name="briefcase-outline"
                  size={13}
                  color="rgba(255,255,255,0.75)"
                />
                <Text style={styles.job}>{location}</Text>
              </View>
            </View>

            {(showLikeButton && onLike) ||
            showMessageButton ||
            (showShareButton && onShare) ? (
              <View style={styles.heroActions} pointerEvents="box-none">
                {showLikeButton && onLike ? (
                  <View style={styles.likeBtn}>
                    <LikeHeartButton liked={liked} onPress={onLike} size={22} />
                  </View>
                ) : null}
                {showShareButton && onShare ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.share')}
                    onPress={onShare}
                    hitSlop={10}
                    style={styles.shareBtn}
                  >
                    <Icon
                      name="share-social-outline"
                      size={22}
                      color={palette.white}
                    />
                  </Pressable>
                ) : null}
                {showMessageButton ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('boom.messagePlaceholder', {
                      name: profile.name,
                    })}
                    onPress={onMessage}
                    hitSlop={10}
                    style={styles.msgBtn}
                  >
                    <Icon
                      name="chatbubble-outline"
                      size={22}
                      color={palette.white}
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <View style={styles.chip}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: profile.isOnline
                      ? colors.success
                      : palette.white,
                  },
                ]}
              />
              <Text style={styles.chipText}>
                {profile.isOnline ? t('boom.online') : t('boom.offline')}
              </Text>
            </View>
            <View style={styles.chip}>
              <Icon name="location" size={14} color={ACCENT_PURPLE} />
              <Text style={styles.chipText}>
                {t('boom.distanceAway', {
                  distance: profile.distanceKm ?? 0,
                })}
              </Text>
            </View>
            <View style={styles.chip}>
              <Icon name="heart" size={14} color={colors.accent} />
              <Text style={styles.chipText} numberOfLines={1}>
                {goal}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.black,
  },
  heroLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    backgroundColor: palette.gray850,
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    zIndex: 3,
    justifyContent: 'flex-end',
  },
  heroSpacer: {
    height: HERO_HEIGHT,
  },
  heroHit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  moreBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    zIndex: 5,
    elevation: 5,
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
    paddingRight: 4,
  },
  heroActions: {
    alignItems: 'center',
    gap: 10,
  },
  likeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  shareBtn: {
    marginTop: 2,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACCENT_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_PURPLE,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    color: palette.white,
    fontSize: fontSize(28),
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  nameComma: {
    color: palette.white,
    fontSize: fontSize(28),
    fontWeight: '800',
  },
  age: {
    fontSize: fontSize(28),
    fontWeight: '800',
  },
  ageMale: {
    color: '#4DA3FF',
  },
  ageFemale: {
    color: palette.pink,
  },
  nameFlagCircle: {
    width: NAME_FLAG_SIZE,
    height: NAME_FLAG_SIZE,
    borderRadius: NAME_FLAG_SIZE / 2,
    borderWidth: 1.5,
    borderColor: palette.gray500,
    overflow: 'hidden',
    backgroundColor: palette.gray850,
  },
  nameFlag: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.45 }],
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  job: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize(13),
    fontWeight: '500',
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor:'rgb(85, 83, 83)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  chipText: {
    color: palette.white,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  msgBtn: {
    marginTop: 2,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACCENT_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_PURPLE,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sheet: {
    backgroundColor: palette.black,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  gallery: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  thumb: {
    width: 168,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: palette.gray850,
  },
  thumbActive: {
    borderColor: ACCENT_YELLOW,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.gray650,
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_YELLOW,
  },
  aboutCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  detailSection: {
    gap: 12,
    paddingTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: palette.white,
    fontSize: fontSize(17),
    fontWeight: '800',
  },
  aboutBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: fontSize(14),
    lineHeight: 21,
    fontWeight: '500',
  },
  sectionMuted: {
    color: colors.textMuted,
    fontSize: fontSize(14),
    fontWeight: '500',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  infoPillSelected: {
    borderColor: ACCENT_YELLOW,
  },
  infoPillEmoji: {
    fontSize: fontSize(14),
  },
  infoPillText: {
    color: palette.white,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  choicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  choicePillSelected: {
    borderColor: ACCENT_YELLOW,
  },
  choicePillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  choicePillTextSelected: {
    color: palette.white,
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ACCENT_YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
