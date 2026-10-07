import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { PAGE_SIZE } from '@/config/constants';
import { Icon, InfiniteListFooter, ScreenContainer, type IconName } from '@/shared/components';
import { colors, fontSize, palette, screen } from '@/theme';

import { useRemoveLikeMutation } from '@/features/matches';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';

import { FilterPickerSheet } from '../components/FilterPickerSheet';
import {
  ArrivingDateRangeSheet,
  arrivingRangeLabel,
  isoFromDate,
} from '../components/ArrivingDateRangeSheet';
import { TravelArrivalCard } from '../components/TravelArrivalCard';
import { TravelCountryCard } from '../components/TravelCountryCard';
import { TravelFilterChips } from '../components/TravelFilterChips';
import {
  useGetTravelArrivalsInfiniteQuery,
  useGetTravelCountriesInfiniteQuery,
} from '../api/travelApi';
import {
  JOURNEY_TYPE_OPTIONS,
  TRAVEL_GENDER_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
} from '../data/mockTravelArrivals';
import type {
  TravelArrival,
  TravelCompanionType,
  TravelStyleType,
  TravelTripType,
} from '../data/mockTravelArrivals';
import { fetchJourneyCountries } from '../data/geoHierarchy';
import { useSwipeAndMatch } from '../hooks/useSwipeAndMatch';
import { parseISODate } from '@/shared/utils/date';

const GRID_GAP = 12;
const GRID_PADDING = 16;
const TILE_WIDTH = Math.floor(
  (screen.width - GRID_PADDING * 2 - GRID_GAP) / 2,
);

export function TravelAlertScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(
    null,
  );
  const [activeFilter, setActiveFilter] = useState<
    'arriving' | 'nationality' | 'purpose' | 'style' | 'gender' | 'viewAll' | null
  >(null);
  const [selectedNationality, setSelectedNationality] = useState<string | null>(
    null,
  );
  const [lookingFor, setLookingFor] = useState<TravelTripType | null>(null);
  const [travelStyle, setTravelStyle] = useState<TravelStyleType | null>(null);
  const [companion, setCompanion] = useState<TravelCompanionType | null>(null);
  const [filterSheet, setFilterSheet] = useState<
    'nationality' | 'lookingFor' | 'arriving' | 'style' | 'gender' | null
  >(null);
  const [nationalityQuery, setNationalityQuery] = useState('');
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [arrivingFrom, setArrivingFrom] = useState<string | null>(null);
  const [arrivingTo, setArrivingTo] = useState<string | null>(null);

  const travelQuery = useMemo(
    () => ({
      fromCountry: selectedNationality,
      tripType: lookingFor,
      fromDate: arrivingFrom,
      toDate: arrivingTo,
      travelStyle,
      companion,
    }),
    [
      arrivingFrom,
      arrivingTo,
      companion,
      lookingFor,
      selectedNationality,
      travelStyle,
    ],
  );
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetTravelArrivalsInfiniteQuery(travelQuery, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const travelArrivals = useMemo(() => flatPageItems(data), [data]);
  const countryRailQuery = useMemo(
    () => ({ limit: PAGE_SIZE.travelCountries }),
    [],
  );
  const {
    data: countryPages,
    isFetchingNextPage: isFetchingNextCountries,
    fetchNextPage: fetchNextCountries,
    hasNextPage: hasNextCountries,
  } = useGetTravelCountriesInfiniteQuery(countryRailQuery, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const countries = useMemo(() => flatPageItems(countryPages), [countryPages]);

  const nationalityPickerQuery = useMemo(
    () => ({
      limit: PAGE_SIZE.travelNationalities,
      q: nationalitySearch || null,
    }),
    [nationalitySearch],
  );
  const {
    data: nationalityPages,
    isFetching: isFetchingNationalities,
    isFetchingNextPage: isFetchingNextNationalities,
    fetchNextPage: fetchNextNationalities,
    hasNextPage: hasNextNationalities,
  } = useGetTravelCountriesInfiniteQuery(nationalityPickerQuery, {
    skip: filterSheet !== 'nationality',
  });
  const nationalityCountries = useMemo(
    () => flatPageItems(nationalityPages),
    [nationalityPages],
  );
  const nationalityOptions = useMemo(
    () =>
      nationalityCountries.map(item => ({
        id: item.country,
        label: item.country,
        flagUrl: item.flagUrl,
      })),
    [nationalityCountries],
  );
  const [swipe] = useSwipeAndMatch();
  const [removeLike] = useRemoveLikeMutation();

  useEffect(() => {
    void fetchJourneyCountries();
  }, []);

  useEffect(() => {
    if (filterSheet !== 'nationality') {
      setNationalityQuery('');
      setNationalitySearch('');
    }
  }, [filterSheet]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setNationalitySearch(nationalityQuery.trim());
    }, 280);
    return () => clearTimeout(handle);
  }, [nationalityQuery]);

  useEffect(() => {
    const next = travelArrivals
      .filter(item => item.liked)
      .map(item => item.id);
    setLikedIds(current =>
      current.length === next.length &&
      current.every((id, index) => id === next[index])
        ? current
        : next,
    );
  }, [travelArrivals]);

  useEffect(() => {
    if (!selectedNationality) {
      return;
    }
    const match =
      countries.find(item => item.country === selectedNationality) ??
      nationalityCountries.find(item => item.country === selectedNationality);
    if (match && selectedCountryId !== match.id) {
      setSelectedCountryId(match.id);
    }
  }, [countries, nationalityCountries, selectedCountryId, selectedNationality]);

  const loadMoreCountries = () =>
    loadMoreIfNeeded({
      hasNextPage: hasNextCountries,
      isFetchingNextPage: isFetchingNextCountries,
      fetchNextPage: fetchNextCountries,
    });

  const loadMoreNationalities = () =>
    loadMoreIfNeeded({
      hasNextPage: hasNextNationalities,
      isFetchingNextPage: isFetchingNextNationalities,
      fetchNextPage: fetchNextNationalities,
    });

  const onCountryRailScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 72) {
      loadMoreCountries();
    }
  };

  const lookingForOptions = useMemo(
    () =>
      JOURNEY_TYPE_OPTIONS.map(item => ({
        id: item.id,
        label: t(item.labelKey),
      })),
    [t],
  );
  const travelStyleOptions = useMemo(
    () =>
      TRAVEL_STYLE_OPTIONS.map(item => ({
        id: item.id,
        label: t(item.labelKey),
      })),
    [t],
  );
  const genderOptions = useMemo(
    () =>
      TRAVEL_GENDER_OPTIONS.map(item => ({
        id: item.id,
        label: t(item.labelKey),
      })),
    [t],
  );

  const arrivingLabel = arrivingRangeLabel(arrivingFrom, arrivingTo);

  const onFilterPress = (
    key: 'arriving' | 'nationality' | 'purpose' | 'style' | 'gender' | 'viewAll',
  ) => {
    if (key === 'nationality') {
      setFilterSheet('nationality');
      return;
    }
    if (key === 'purpose') {
      setFilterSheet('lookingFor');
      return;
    }
    if (key === 'style') {
      setFilterSheet('style');
      return;
    }
    if (key === 'gender') {
      setFilterSheet('gender');
      return;
    }
    if (key === 'arriving') {
      setFilterSheet('arriving');
      return;
    }
    if (key === 'viewAll') {
      setSelectedNationality(null);
      setLookingFor(null);
      setTravelStyle(null);
      setCompanion(null);
      setSelectedCountryId(null);
      setArrivingFrom(null);
      setArrivingTo(null);
      setActiveFilter(current => (current === 'viewAll' ? null : 'viewAll'));
      return;
    }
    setActiveFilter(current => (current === key ? null : key));
  };

  const toggleLike = (arrival: TravelArrival) => {
    const userId = arrival.userId ?? arrival.id;
    const liked = likedIds.includes(arrival.id);
    setLikedIds(current =>
      liked
        ? current.filter(item => item !== arrival.id)
        : [...current, arrival.id],
    );
    if (liked) {
      void removeLike(userId);
      return;
    }
    void swipe({ targetUserId: userId, action: 'like' });
  };

  const openMenuAction = (screen: 'CreateJourney' | 'MyJourneys') => {
    setMenuOpen(false);
    // Wait for the menu Modal to dismiss so it can't sit above the next
    // screen and swallow presses (e.g. the back button).
    requestAnimationFrame(() => {
      navigation.navigate(screen);
    });
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.chrome}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={styles.backBtn}
          >
            <Icon name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{t('travel.whoTraveling')}</Text>
            <Text style={styles.subtitle}>{t('travel.whoTravelingHint')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('travel.menu')}
            onPress={() => setMenuOpen(true)}
            style={styles.menuBtn}
          >
            <Icon
              name="ellipsis-vertical"
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        <TravelFilterChips
          active={activeFilter}
          nationalityLabel={selectedNationality}
          lookingForLabel={
            lookingFor
              ? t(
                  (
                    JOURNEY_TYPE_OPTIONS.find(item => item.id === lookingFor) ??
                    JOURNEY_TYPE_OPTIONS[0]
                  ).labelKey,
                )
              : null
          }
          arrivingLabel={arrivingLabel}
          travelStyleLabel={
            travelStyle
              ? t(
                  (
                    TRAVEL_STYLE_OPTIONS.find(item => item.id === travelStyle) ??
                    TRAVEL_STYLE_OPTIONS[0]
                  ).labelKey,
                )
              : null
          }
          genderLabel={
            companion
              ? t(
                  (
                    TRAVEL_GENDER_OPTIONS.find(item => item.id === companion) ??
                    TRAVEL_GENDER_OPTIONS[0]
                  ).labelKey,
                )
              : null
          }
          onPress={onFilterPress}
        />

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.countryRail}
          style={styles.countryScroller}
          onScroll={onCountryRailScroll}
          scrollEventThrottle={16}
        >
          {countries.map(country => (
            <TravelCountryCard
              key={country.id}
              country={country}
              selected={selectedCountryId === country.id}
              onPress={() => {
                setSelectedCountryId(current => {
                  const next = current === country.id ? null : country.id;
                  setSelectedNationality(next ? country.country : null);
                  if (next) {
                    setActiveFilter('nationality');
                  }
                  return next;
                });
              }}
            />
          ))}
          {isFetchingNextCountries ? (
            <View style={styles.countryFooter}>
              <ActivityIndicator color={palette.white} />
            </View>
          ) : null}
        </ScrollView>
      </View>

      <FlatList
        data={travelArrivals}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={styles.scroll}
        onEndReached={() =>
          loadMoreIfNeeded({ hasNextPage, isFetchingNextPage, fetchNextPage })
        }
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          <InfiniteListFooter loading={isFetchingNextPage} />
        }
        ListEmptyComponent={
          isLoading || isFetching ? (
            <View style={styles.empty}>
              <ActivityIndicator color={palette.white} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {t('travel.noArrivalsTitle')}
              </Text>
              <Text style={styles.emptyHint}>{t('travel.noArrivalsHint')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TravelArrivalCard
            arrival={item}
            width={TILE_WIDTH}
            liked={likedIds.includes(item.id)}
            onPress={() =>
              navigation.navigate('TravelArrivalDetail', {
                arrivalId: item.id,
              })
            }
            onToggleLike={() => toggleLike(item)}
          />
        )}
      />

      {menuOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable
            style={styles.menuScrim}
            onPress={() => setMenuOpen(false)}
          >
            <Pressable
              style={styles.menuCard}
              onPress={event => event.stopPropagation()}
            >
              {(
                [
                  {
                    key: 'create',
                    icon: 'add-circle-outline' as IconName,
                    label: t('travel.createJourneyAction'),
                    screen: 'CreateJourney' as const,
                  },
                  {
                    key: 'journeys',
                    icon: 'airplane-outline' as IconName,
                    label: t('travel.seeYourJourney'),
                    screen: 'MyJourneys' as const,
                  },
                ] as const
              ).map(item => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={() => openMenuAction(item.screen)}
                  style={styles.menuItem}
                >
                  <Icon name={item.icon} size={20} color={colors.textPrimary} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Icon
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      <FilterPickerSheet
        visible={filterSheet === 'nationality'}
        title={t('travel.selectNationality')}
        searchPlaceholder={t('travel.searchNationality')}
        options={nationalityOptions}
        selected={selectedNationality}
        remoteSearch
        loading={isFetchingNationalities && !isFetchingNextNationalities}
        loadingMore={isFetchingNextNationalities}
        onClose={() => setFilterSheet(null)}
        onSearchChange={setNationalityQuery}
        onEndReached={loadMoreNationalities}
        onSelect={id => {
          setSelectedNationality(current => (current === id ? null : id));
          const match =
            nationalityCountries.find(item => item.country === id) ??
            countries.find(item => item.country === id);
          setSelectedCountryId(match?.id ?? null);
          setActiveFilter('nationality');
        }}
      />

      <FilterPickerSheet
        visible={filterSheet === 'lookingFor'}
        title={t('travel.selectJourneyType')}
        options={lookingForOptions}
        selected={lookingFor}
        onClose={() => setFilterSheet(null)}
        onSelect={id => {
          const next = id as TravelTripType;
          setLookingFor(current => (current === next ? null : next));
          setActiveFilter('purpose');
        }}
      />

      <FilterPickerSheet
        visible={filterSheet === 'style'}
        title={t('travel.selectTravelStyle')}
        options={travelStyleOptions}
        selected={travelStyle}
        onClose={() => setFilterSheet(null)}
        onSelect={id => {
          const next = id as TravelStyleType;
          setTravelStyle(current => (current === next ? null : next));
          setActiveFilter('style');
        }}
      />

      <FilterPickerSheet
        visible={filterSheet === 'gender'}
        title={t('travel.selectGender')}
        options={genderOptions}
        selected={companion}
        onClose={() => setFilterSheet(null)}
        onSelect={id => {
          const next = id as TravelCompanionType;
          setCompanion(current => (current === next ? null : next));
          setActiveFilter('gender');
        }}
      />

      <ArrivingDateRangeSheet
        visible={filterSheet === 'arriving'}
        fromDate={arrivingFrom ? parseISODate(arrivingFrom) : null}
        toDate={arrivingTo ? parseISODate(arrivingTo) : null}
        onClose={() => setFilterSheet(null)}
        onClear={() => {
          setArrivingFrom(null);
          setArrivingTo(null);
          setActiveFilter(current => (current === 'arriving' ? null : current));
          setFilterSheet(null);
        }}
        onApply={(from, to) => {
          setArrivingFrom(isoFromDate(from));
          setArrivingTo(isoFromDate(to));
          setActiveFilter('arriving');
          setFilterSheet(null);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chrome: {
    backgroundColor: colors.background,
    paddingBottom: 4,
  },
  list: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 48,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingBottom: 14,
    gap: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 2,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    marginTop: 2,
    backgroundColor: palette.gray850,
    borderWidth: 1,
    borderColor: palette.gray650,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(28),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '400',
  },
  countryScroller: {
    marginTop: 16,
    marginBottom: 4,
    height: 168,
  },
  countryRail: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  countryFooter: {
    width: 40,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridRow: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 12,
    gap: GRID_GAP,
  },
  empty: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 18,
  },
  menuScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 96,
    paddingRight: 16,
  },
  menuCard: {
    width: 240,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: palette.gray650,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gray750,
  },
  menuLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
});
