import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';
import { BusyOverlay, Icon, InfiniteListFooter, ScreenContainer } from '@/shared/components';
import { showErrorAlert, showSuccessAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';

import {
  useDeleteJourneyMutation,
  useGetMyJourneysInfiniteQuery,
} from '../api/travelApi';
import { TRAVEL_TRIP_META } from '../data/mockTravelArrivals';
import { type MyJourney } from '../data/mockMyJourneys';
import { flagUrl } from '../data/journeyLocations';
import { formatTravelDate } from '../utils/travelDates';

const ACCENT = '#A855F7';

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

const STATUS_COLOR = {
  upcoming: '#3B82F6',
  active: '#22C55E',
  landed: '#F59E0B',
} as const;

export function MyJourneysScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetMyJourneysInfiniteQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const journeys = useMemo(() => flatPageItems(data), [data]);
  const [deleteJourney, { isLoading: deleting }] = useDeleteJourneyMutation();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      total: journeys.length,
      upcoming: journeys.filter(item => item.status === 'upcoming').length,
      active: journeys.filter(item => item.status === 'active').length,
    };
  }, [journeys]);

  const deleteTarget = journeys.find(item => item.id === deleteId) ?? null;

  const confirmDelete = async () => {
    if (!deleteId || deleting) {
      return;
    }
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteJourney(id).unwrap();
      showSuccessAlert(t('travel.deleteSuccess'));
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const onEdit = (journey: MyJourney) => {
    navigation.navigate('CreateJourney', { journeyId: journey.id });
  };

  const onBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('TravelAlert');
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          hitSlop={16}
          style={styles.backBtn}
        >
          <Icon name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('travel.createdJourneys')}</Text>
          <Text style={styles.subtitle}>{t('travel.createdJourneysHint')}</Text>
        </View>
      </View>

      {journeys.length > 0 ? (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.total}</Text>
            <Text style={styles.statLabel}>{t('travel.statTotal')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.upcoming}</Text>
            <Text style={styles.statLabel}>{t('travel.status.upcoming')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.active}</Text>
            <Text style={styles.statLabel}>{t('travel.status.active')}</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          journeys.length === 0 && styles.scrollEmpty,
        ]}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent }) => {
          const nearEnd =
            nativeEvent.layoutMeasurement.height +
              nativeEvent.contentOffset.y >=
            nativeEvent.contentSize.height - 240;
          if (nearEnd) {
            loadMoreIfNeeded({
              hasNextPage,
              isFetchingNextPage,
              fetchNextPage,
            });
          }
        }}
      >
        {isLoading && journeys.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : journeys.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="airplane-outline" size={36} color={ACCENT} />
            </View>
            <Text style={styles.emptyTitle}>{t('travel.noJourneysTitle')}</Text>
            <Text style={styles.emptyHint}>{t('travel.noJourneysHint')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('CreateJourney')}
              style={styles.emptyCtaWrap}
            >
              <LinearGradient
                colors={['#C026FF', '#7C3AED']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.emptyCta}
              >
                <Text style={styles.emptyCtaText}>
                  {t('travel.createJourneyAction')}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          journeys.map(journey => {
            const trip =
              TRAVEL_TRIP_META[journey.tripType] ?? TRAVEL_TRIP_META.vacation;
            return (
              <View key={journey.id} style={styles.card}>
                {journey.coverImage ? (
                  <Image
                    source={{ uri: journey.coverImage }}
                    style={styles.cover}
                  />
                ) : (
                  <View style={[styles.cover, styles.coverFallback]} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.92)']}
                  style={styles.coverFade}
                />

                <View
                  style={[
                    styles.status,
                    {
                      backgroundColor:
                        STATUS_COLOR[journey.status] ?? STATUS_COLOR.upcoming,
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {t(`travel.status.${journey.status}`)}
                  </Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.routeBlock}>
                    <View style={styles.routePoint}>
                      <Text style={styles.city}>{journey.fromCity}</Text>
                      <View style={styles.countryRow}>
                        {journey.fromCountryFlag || journey.fromCountryCode ? (
                          <Image
                            source={{
                              uri:
                                journey.fromCountryFlag ||
                                flagUrl(journey.fromCountryCode || ''),
                            }}
                            style={styles.countryFlag}
                            resizeMode="cover"
                          />
                        ) : null}
                        <Text style={styles.country}>{journey.fromCountry}</Text>
                      </View>
                    </View>
                    <View style={styles.routeMid}>
                      <View style={styles.routeLine} />
                      <View
                        style={[styles.planeDot, { backgroundColor: trip.color }]}
                      >
                        <Icon name="airplane" size={12} color={palette.white} />
                      </View>
                      <View style={styles.routeLine} />
                    </View>
                    <View style={[styles.routePoint, styles.routePointEnd]}>
                      <Text style={styles.city}>{journey.toCity}</Text>
                      <View style={[styles.countryRow, styles.countryRowEnd]}>
                        {journey.toCountryFlag || journey.toCountryCode ? (
                          <Image
                            source={{
                              uri:
                                journey.toCountryFlag ||
                                flagUrl(journey.toCountryCode || ''),
                            }}
                            style={styles.countryFlag}
                            resizeMode="cover"
                          />
                        ) : null}
                        <Text style={styles.country}>{journey.toCountry}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Icon name="calendar-outline" size={14} color={ACCENT} />
                    <Text style={styles.metaText}>
                      {formatTravelDate(journey.departure)}
                      {journey.returnDate
                        ? ` – ${formatTravelDate(journey.returnDate)}`
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.tags}>
                    <View style={[styles.tag, { backgroundColor: trip.color }]}>
                      <Icon name={trip.icon} size={11} color={palette.white} />
                      <Text style={styles.tagText}>{t(trip.labelKey)}</Text>
                    </View>
                    <View style={styles.tagMuted}>
                      <Text style={styles.tagMutedText}>
                        {t(STYLE_LABEL[journey.travelStyle] ?? STYLE_LABEL.solo)}
                      </Text>
                    </View>
                    <View style={styles.tagMuted}>
                      <Text style={styles.tagMutedText}>
                        {t(
                          COMPANION_LABEL[journey.companion] ??
                            COMPANION_LABEL.any,
                        )}
                      </Text>
                    </View>
                    {journey.hideFromCountry ? (
                      <View style={styles.tagMuted}>
                        <Icon name="eye-off" size={11} color="#F5C400" />
                        <Text style={styles.tagMutedText}>
                          {journey.hideFrom
                            ? t('travel.hideSelected', {
                                who: t(`travel.hide.${journey.hideFrom}`),
                              })
                            : t('travel.hiddenTag')}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.description} numberOfLines={2}>
                    {journey.description}
                  </Text>

                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onEdit(journey)}
                      style={styles.editBtn}
                    >
                      <Icon name="create-outline" size={16} color={palette.white} />
                      <Text style={styles.editText}>{t('travel.editJourney')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDeleteId(journey.id)}
                      style={styles.deleteBtn}
                    >
                      <Icon name="trash-outline" size={16} color="#FF6B6B" />
                      <Text style={styles.deleteText}>
                        {t('travel.deleteJourney')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <InfiniteListFooter loading={isFetchingNextPage} />
      </ScrollView>

      {deleteId != null ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteId(null)}
        >
          <Pressable
            style={styles.dialogScrim}
            onPress={() => setDeleteId(null)}
          >
            <Pressable
              style={styles.dialog}
              onPress={event => event.stopPropagation()}
            >
              <View style={styles.dialogIcon}>
                <Icon name="trash-outline" size={22} color="#FF6B6B" />
              </View>
              <Text style={styles.dialogTitle}>{t('travel.deleteTitle')}</Text>
              <Text style={styles.dialogHint}>
                {t('travel.deleteHint', {
                  route: deleteTarget
                    ? `${deleteTarget.fromCity} → ${deleteTarget.toCity}`
                    : '',
                })}
              </Text>
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDeleteId(null)}
                  style={styles.dialogCancel}
                >
                  <Text style={styles.dialogCancelText}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={confirmDelete}
                  style={styles.dialogDelete}
                >
                  <Text style={styles.dialogDeleteText}>
                    {t('travel.deleteConfirm')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      <BusyOverlay
        visible={deleting}
        message={t('travel.deletingJourney')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '400',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: palette.gray750,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  scrollEmpty: {
    flexGrow: 1,
  },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 12,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(168,85,247,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyCtaWrap: {
    marginTop: 10,
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyCta: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyCtaText: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  cover: {
    width: '100%',
    height: 120,
  },
  coverFallback: {
    backgroundColor: '#1F2A44',
  },
  coverFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 40,
    height: 80,
  },
  status: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    color: palette.white,
    fontSize: fontSize(11),
    fontWeight: '800',
  },
  cardBody: {
    padding: 14,
    gap: 10,
  },
  routeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routePoint: {
    flex: 1,
    gap: 2,
  },
  routePointEnd: {
    alignItems: 'flex-end',
  },
  city: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  country: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    fontWeight: '500',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryRowEnd: {
    justifyContent: 'flex-end',
  },
  countryFlag: {
    width: 18,
    height: 12,
    borderRadius: 2,
    backgroundColor: palette.gray750,
  },
  routeMid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 64,
  },
  routeLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.gray650,
  },
  planeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagText: {
    color: palette.white,
    fontSize: fontSize(10),
    fontWeight: '700',
  },
  tagMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: palette.gray750,
  },
  tagMutedText: {
    color: colors.textPrimary,
    fontSize: fontSize(10),
    fontWeight: '700',
  },
  description: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  editText: {
    color: palette.white,
    fontSize: fontSize(13),
    fontWeight: '800',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
  },
  deleteText: {
    color: '#FF6B6B',
    fontSize: fontSize(13),
    fontWeight: '800',
  },
  dialogScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dialog: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: palette.gray650,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  dialogIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,107,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dialogTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
  dialogHint: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  dialogDelete: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogDeleteText: {
    color: palette.white,
    fontSize: fontSize(14),
    fontWeight: '800',
  },
});
