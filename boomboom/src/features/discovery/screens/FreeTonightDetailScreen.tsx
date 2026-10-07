import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '@/navigation/types';
import { Icon } from '@/shared/components';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { fontSize, palette, screen } from '@/theme';

import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';
import { flatPageItems } from '@/shared/utils/pagination';

import { useGetMyTonightQuery, useGetTonightInfiniteQuery } from '../api/tonightApi';
import { flagUrl } from '../data/journeyLocations';
import { tonightActivityMeta } from '../data/mockFreeTonight';

type Props = RootStackScreenProps<'FreeTonightDetail'>;

const BG = '#05070F';
const PINK = '#FF2D8A';
const BLUE = '#3AA0FF';
const CARD = '#0C101C';
const AVATAR = 96;
const FEATURED_HEIGHT = Math.min(screen.width * 0.72, 280);

export function FreeTonightDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: me } = useGetMyProfileQuery();
  const { data: mine } = useGetMyTonightQuery();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetTonightInfiniteQuery();
  const people = useMemo(() => flatPageItems(data), [data]);
  const person = useMemo(() => {
    const found = people.find(item => item.id === route.params.personId);
    if (found) {
      return found;
    }
    if (mine?.id === route.params.personId) {
      return mine;
    }
    return undefined;
  }, [mine, people, route.params.personId]);

  useEffect(() => {
    if (!person && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, person]);
  const profileId = person?.userId ?? person?.id;
  const isOwn =
    Boolean(person?.isOwn) ||
    Boolean(me?.id && person?.userId === me.id);

  if (isLoading && !person) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>{t('freeTonight.detailNotFound')}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const activity = tonightActivityMeta(person.activity);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            style={styles.roundBtn}
          >
            <Icon name="chevron-back" size={22} color={palette.white} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('freeTonight.share')}
              style={styles.roundBtn}
            >
              <Icon name="share-outline" size={18} color={palette.white} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('travel.menu')}
              style={styles.roundBtn}
            >
              <Icon
                name="ellipsis-horizontal"
                size={18}
                color={palette.white}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: person.photo }}
              style={styles.avatar}
              resizeMode="cover"
            />
            {person.isOnline ? <View style={styles.onlineDot} /> : null}
            {person.countryFlag || person.flagCode ? (
              <View style={styles.avatarFlag}>
                <Image
                  source={{
                    uri:
                      person.countryFlag ||
                      profileFlagUrl(person) ||
                      flagUrl(person.flagCode),
                  }}
                  style={styles.avatarFlagImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </View>

          <View style={styles.headerCopy}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {person.name},{' '}
                <Text
                  style={[
                    styles.age,
                    person.gender === 'man' && styles.ageMale,
                    person.gender === 'woman' && styles.ageFemale,
                  ]}
                >
                  {person.age}
                </Text>
              </Text>
              {person.isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Icon name="checkmark" size={11} color={palette.white} />
                </View>
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="location" size={12} color={PINK} />
                <Text style={styles.metaText}>
                  {t('home.distanceAway', { distance: person.distanceKm })}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Icon name="resize-outline" size={12} color={palette.white} />
                <Text style={styles.metaText}>{person.heightLabel}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaEmoji}>{activity.emoji}</Text>
                <Text style={styles.metaText}>{t(activity.labelKey)}</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.freePill}>
                <Icon name="time-outline" size={13} color={palette.white} />
                <Text style={styles.freePillText}>
                  {t('freeTonight.title')}
                </Text>
              </View>
              <Text style={styles.endsIn}>
                {t('freeTonight.endsIn', { time: person.endsIn })}
              </Text>
            </View>

            <Text style={styles.tagline}>{person.tagline}</Text>
          </View>
        </View>

        <View style={styles.featuredWrap}>
          <Image
            source={{ uri: person.featuredPhoto }}
            style={styles.featured}
            resizeMode="cover"
          />
          <View style={styles.venueTag}>
            <Icon name="location" size={12} color={PINK} />
            <Text style={styles.venueText}>{person.venue}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.lookingCard]}>
          <View style={styles.lookingHeader}>
            <Icon name="heart-outline" size={18} color={PINK} />
            <Text style={styles.cardTitle}>
              {t('freeTonight.lookingForTitle')}
            </Text>
          </View>
          <View style={styles.lookingBody}>
            <Text style={styles.lookingText}>{person.lookingFor}</Text>
            <View style={styles.lookingArt}>
              <Icon name="wine" size={34} color={PINK} />
              <Icon
                name="wine-outline"
                size={28}
                color="rgba(255,45,138,0.75)"
                style={styles.lookingArtSecond}
              />
            </View>
          </View>
        </View>

        {isOwn ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('UserProfile', {
                userId: profileId ?? person.id,
              })
            }
            style={[styles.card, styles.helloCard]}
          >
            <Icon name="sparkles" size={18} color={BLUE} />
            <View style={styles.helloCopy}>
              <Text style={styles.helloTitle}>{t('freeTonight.sayHello')}</Text>
              <Text style={styles.helloHint}>
                {t('freeTonight.sayHelloHint')}
              </Text>
            </View>
            <Icon name="chatbubble-ellipses" size={22} color={BLUE} />
          </Pressable>
        )}

        <View style={[styles.card, styles.viewsCard]}>
          <Icon name="eye-outline" size={22} color={PINK} />
          <View style={styles.viewsCopy}>
            <Text style={styles.viewsTitle}>
              {t('freeTonight.visitProfiles', { count: person.viewsLeft })}
            </Text>
            <Text style={styles.viewsHint}>
              <Text style={styles.viewsHintAccent}>{person.viewsLeft}</Text>
              {t('freeTonight.viewsLeftSuffix')}
            </Text>
          </View>
          <Icon name="person-outline" size={22} color={PINK} />
        </View>

        {isOwn ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('UserProfile', {
                userId: profileId ?? person.id,
              })
            }
          >
            <LinearGradient
              colors={['#FF2D8A', '#FF6BB5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewProfileBtn}
            >
              <Icon name="person" size={18} color={palette.white} />
              <Text style={styles.viewProfileText}>
                {t('freeTonight.viewProfile')}
              </Text>
              <Icon name="chevron-forward" size={18} color={palette.white} />
            </LinearGradient>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyTitle: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  emptyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PINK,
  },
  emptyBtnText: {
    color: palette.white,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#121826',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  onlineDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: BG,
  },
  avatarFlag: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.white,
    backgroundColor: '#1E293B',
  },
  avatarFlagImage: {
    width: '100%',
    height: '100%',
  },
  headerCopy: {
    flex: 1,
    gap: 8,
    paddingTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    color: palette.white,
    fontSize: fontSize(24),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  age: {
    fontWeight: '800',
  },
  ageMale: {
    color: BLUE,
  },
  ageFemale: {
    color: PINK,
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaEmoji: {
    fontSize: fontSize(11),
  },
  metaText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  metaDivider: {
    width: 1,
    height: 11,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  freePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PINK,
    backgroundColor: 'rgba(255,45,138,0.12)',
    shadowColor: PINK,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  freePillText: {
    color: palette.white,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  endsIn: {
    color: PINK,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  tagline: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: fontSize(13),
    fontStyle: 'italic',
    fontWeight: '500',
  },
  featuredWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#151515',
  },
  featured: {
    width: '100%',
    height: FEATURED_HEIGHT,
  },
  venueTag: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  venueText: {
    color: palette.white,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    backgroundColor: CARD,
    padding: 16,
  },
  lookingCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,45,138,0.45)',
    gap: 12,
  },
  lookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  lookingBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lookingText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: fontSize(13),
    lineHeight: 19,
    fontWeight: '500',
  },
  lookingArt: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookingArtSecond: {
    position: 'absolute',
    right: 4,
    bottom: 8,
  },
  helloCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(58,160,255,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: BLUE,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  helloCopy: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  helloTitle: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '800',
    textAlign: 'center',
  },
  helloHint: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: fontSize(12),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  viewsCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,45,138,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: PINK,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  viewsCopy: {
    flex: 1,
    gap: 3,
  },
  viewsTitle: {
    color: palette.white,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  viewsHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize(12),
    fontWeight: '500',
  },
  viewsHintAccent: {
    color: PINK,
    fontWeight: '800',
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 999,
  },
  viewProfileText: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
});
