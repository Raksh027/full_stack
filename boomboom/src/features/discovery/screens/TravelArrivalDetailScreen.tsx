import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
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
import { fontSize, palette, screen } from '@/theme';

import {
  useGetTravelArrivalQuery,
} from '../api/travelApi';
import { flagUrl } from '../data/journeyLocations';
import {
  TRAVEL_TRIP_META,
  type TravelInterestTag,
} from '../data/mockTravelArrivals';
import { formatTravelDate } from '../utils/travelDates';

const STYLE_LABEL = {
  solo: 'travel.styleSolo',
  group: 'travel.styleGroup',
  backpacker: 'travel.styleBackpacker',
  couple: 'travel.styleCouple',
} as const;

const COMPANION_LABEL = {
  any: 'travel.companionAny',
  male: 'travel.companionMale',
  female: 'travel.companionFemale',
} as const;

type Props = RootStackScreenProps<'TravelArrivalDetail'>;

const BG = '#050B18';
const BLUE = '#2F80FF';
const BLUE_SOFT = '#4DA3FF';
const PINK = '#FF4D8D';
const HERO_HEIGHT = Math.min(screen.height * 0.42, 360);
const AVATAR = 92;

function tagColors(tone: TravelInterestTag['tone']) {
  if (tone === 'pink') {
    return { border: PINK, icon: PINK, text: '#FFD0E2' };
  }
  if (tone === 'blue') {
    return { border: BLUE_SOFT, icon: BLUE_SOFT, text: '#D6E8FF' };
  }
  return { border: '#3B5BDB', icon: '#9DB4FF', text: '#C9D4FF' };
}

export function TravelArrivalDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const arrivalId = route.params.arrivalId;
  const { data: arrival, isLoading } = useGetTravelArrivalQuery(arrivalId);

  if (isLoading && !arrival) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!arrival) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>{t('travel.detailNotFound')}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const profileId = arrival.userId ?? arrival.id;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.heroWrap}>
          <ImageBackground
            source={{ uri: arrival.coverPhoto }}
            style={styles.hero}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(5,11,24,0.15)', 'rgba(5,11,24,0.55)', BG]}
              locations={[0.2, 0.65, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.heroActions, { paddingTop: insets.top + 8 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                onPress={() => navigation.goBack()}
                style={styles.roundBtn}
              >
                <Icon name="chevron-back" size={22} color={palette.white} />
              </Pressable>
            </View>
          </ImageBackground>

          <View style={styles.avatarBlock}>
            <View style={styles.avatarRing}>
              <Image
                source={{ uri: arrival.photo }}
                style={styles.avatar}
                resizeMode="cover"
              />
              {arrival.isOnline ? <View style={styles.onlineDot} /> : null}
              <View style={styles.avatarFlag}>
                <Image
                  source={{
                    uri:
                      arrival.flagUrl ||
                      arrival.fromCountryFlag ||
                      flagUrl(arrival.flagCode),
                  }}
                  style={styles.avatarFlagImage}
                  resizeMode="cover"
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.profileBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {arrival.name},{' '}
              <Text
                style={[
                  styles.age,
                  arrival.gender === 'man' && styles.ageMale,
                  arrival.gender === 'woman' && styles.ageFemale,
                ]}
              >
                {arrival.age}
              </Text>
            </Text>
            {arrival.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark" size={12} color={palette.white} />
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {[
              {
                key: 'place',
                icon: 'location' as const,
                color: PINK,
                text: [arrival.city, arrival.country].filter(Boolean).join(', '),
              },
              arrival.heightLabel
                ? {
                    key: 'height',
                    icon: 'resize-outline' as const,
                    color: palette.white,
                    text: arrival.heightLabel,
                  }
                : null,
              arrival.zodiac
                ? {
                    key: 'zodiac',
                    icon: 'sparkles-outline' as const,
                    color: palette.white,
                    text: arrival.zodiac,
                  }
                : null,
            ]
              .filter((item): item is NonNullable<typeof item> => Boolean(item?.text))
              .map((item, index) => (
                <View key={item.key} style={styles.metaItemWrap}>
                  {index > 0 ? <View style={styles.metaDivider} /> : null}
                  <View style={styles.metaItem}>
                    <Icon name={item.icon} size={13} color={item.color} />
                    <Text style={styles.metaText}>{item.text}</Text>
                  </View>
                </View>
              ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tags}
          >
            {arrival.tags.map(tag => {
              const colors = tagColors(tag.tone);
              return (
                <View
                  key={tag.id}
                  style={[styles.tag, { borderColor: colors.border }]}
                >
                  <Icon name={tag.icon} size={13} color={colors.icon} />
                  <Text style={[styles.tagText, { color: colors.text }]}>
                    {t(tag.labelKey)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.planCard}>
            <ImageBackground
              source={{ uri: arrival.coverPhoto }}
              style={styles.planHeader}
              imageStyle={styles.planHeaderImage}
            >
              <LinearGradient
                colors={['rgba(5,11,24,0.2)', 'rgba(5,11,24,0.85)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.planHeaderIcon}>
                <Icon name="airplane" size={16} color={palette.white} />
              </View>
              <View style={styles.planHeaderCopy}>
                <Text style={styles.planTitle}>{t('travel.travelPlan')}</Text>
                <Text style={styles.planSubtitle}>
                  {t('travel.arrivingOn', {
                    date: formatTravelDate(arrival.arrivalDate),
                  })}
                  {' • '}
                  {t('travel.travelPlan')}
                </Text>
              </View>
            </ImageBackground>

            <View style={styles.planBody}>
              <View style={styles.routeRow}>
                <View style={styles.routeSide}>
                  <View style={styles.routeIconBlue}>
                    <Icon name="airplane" size={14} color={BLUE} />
                  </View>
                  <View style={styles.routeCopy}>
                    <Text style={styles.routeLabel}>{t('travel.from')}</Text>
                    <View style={styles.routeValueRow}>
                      {arrival.fromCountryFlag || arrival.fromCountryCode ? (
                        <Image
                          source={{
                            uri:
                              arrival.fromCountryFlag ||
                              flagUrl(arrival.fromCountryCode || ''),
                          }}
                          style={styles.routeFlag}
                          resizeMode="cover"
                        />
                      ) : null}
                      <Text style={styles.routeValue}>
                        {arrival.fromCity}, {arrival.fromCountry}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.routeArrow}>
                  <Icon name="arrow-forward" size={18} color={BLUE} />
                </View>

                <View style={[styles.routeSide, styles.routeSideEnd]}>
                  <View style={styles.routeCopyEnd}>
                    <Text style={[styles.routeLabel, styles.alignRight]}>
                      {t('travel.to')}
                    </Text>
                    <Text style={[styles.routeValue, styles.alignRight]}>
                      {arrival.toCity}, {arrival.toCountry}
                    </Text>
                  </View>
                  <View style={styles.toFlag}>
                    <Image
                      source={{
                        uri:
                          arrival.toCountryFlag ||
                          flagUrl(arrival.toFlagCode),
                      }}
                      style={styles.toFlagImage}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.planStats}>
                <View style={styles.planStat}>
                  <Icon name="calendar-outline" size={18} color="#64748B" />
                  <Text style={styles.planStatValue}>
                    {formatTravelDate(arrival.arrivalDate)}
                    {arrival.returnDate
                      ? ` – ${formatTravelDate(arrival.returnDate)}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.planStatDivider} />
                <View style={styles.planStat}>
                  <Icon name="briefcase-outline" size={18} color="#64748B" />
                  <Text style={styles.planStatValue}>
                    {t(
                      (
                        TRAVEL_TRIP_META[arrival.tripType] ??
                        TRAVEL_TRIP_META.vacation
                      ).labelKey,
                    )}
                  </Text>
                </View>
                <View style={styles.planStatDivider} />
                <View style={styles.planStat}>
                  <Icon name="person-outline" size={18} color="#64748B" />
                  <Text style={styles.planStatValue}>
                    {t(
                      STYLE_LABEL[
                        arrival.travelStyle as keyof typeof STYLE_LABEL
                      ] ?? STYLE_LABEL.solo,
                    )}
                  </Text>
                </View>
                {arrival.companion ? (
                  <>
                    <View style={styles.planStatDivider} />
                    <View style={styles.planStat}>
                      <Icon name="people-outline" size={18} color="#64748B" />
                      <Text style={styles.planStatValue}>
                        {t(
                          COMPANION_LABEL[
                            arrival.companion as keyof typeof COMPANION_LABEL
                          ] ?? COMPANION_LABEL.any,
                        )}
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.quoteBox}>
                <Text style={styles.quoteText}>
                  ✨ {arrival.quote} ✈️
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('UserProfile', { userId: profileId })
            }
            style={styles.helloCard}
          >
            <View style={styles.helloIcon}>
              <Icon name="chatbubble" size={22} color={palette.white} />
            </View>
            <View style={styles.helloCopy}>
              <Text style={styles.helloTitle}>{t('travel.sayHello')}</Text>
              <Text style={styles.helloHint}>{t('travel.sayHelloHint')}</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={palette.white} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('UserProfile', { userId: profileId })
            }
          >
            <LinearGradient
              colors={['#2F80FF', '#56CCF2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewProfileBtn}
            >
              <Icon name="person" size={18} color={palette.white} />
              <Text style={styles.viewProfileText}>
                {t('travel.viewProfile')}
              </Text>
              <Icon name="chevron-forward" size={18} color={palette.white} />
            </LinearGradient>
          </Pressable>
        </View>
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
    backgroundColor: BLUE,
  },
  emptyBtnText: {
    color: palette.white,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 1,
  },
  heroWrap: {
    marginBottom: 56,
  },
  hero: {
    width: '100%',
    height: HERO_HEIGHT,
  },
  heroActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBlock: {
    position: 'absolute',
    left: 20,
    bottom: -46,
  },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    borderColor: palette.white,
    overflow: 'visible',
    backgroundColor: '#1E293B',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR / 2,
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
    borderColor: palette.white,
  },
  avatarFlag: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.white,
    backgroundColor: '#1E293B',
  },
  avatarFlagImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.4 }],
  },
  profileBody: {
    paddingHorizontal: 16,
    gap: 14,
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
  age: {
    fontWeight: '800',
  },
  ageMale: {
    color: BLUE_SOFT,
  },
  ageFemale: {
    color: PINK,
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  tagText: {
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  planCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: palette.white,
  },
  planHeader: {
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planHeaderImage: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  planHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  planTitle: {
    color: palette.white,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
  planSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize(12),
    fontWeight: '500',
  },
  planBody: {
    padding: 14,
    gap: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeSideEnd: {
    justifyContent: 'flex-end',
  },
  routeIconBlue: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(47,128,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeCopy: {
    flex: 1,
    gap: 2,
  },
  routeCopyEnd: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    color: '#64748B',
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  routeValue: {
    color: '#0F172A',
    fontSize: fontSize(13),
    fontWeight: '800',
    flexShrink: 1,
  },
  routeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeFlag: {
    width: 18,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  alignRight: {
    textAlign: 'right',
  },
  routeArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(47,128,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toFlag: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  toFlagImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.4 }],
  },
  planStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingVertical: 4,
    rowGap: 10,
  },
  planStat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  planStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  planStatValue: {
    color: '#0F172A',
    fontSize: fontSize(12),
    fontWeight: '700',
    textAlign: 'center',
  },
  quoteBox: {
    backgroundColor: '#E8F2FF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quoteText: {
    color: '#1E3A5F',
    fontSize: fontSize(13),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  helloCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#0B1224',
    borderWidth: 1,
    borderColor: 'rgba(47,128,255,0.45)',
  },
  helloIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helloCopy: {
    flex: 1,
    gap: 2,
  },
  helloTitle: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  helloHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize(11),
    fontWeight: '500',
    lineHeight: 15,
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
