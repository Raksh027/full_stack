import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Icon, InfiniteListFooter, ScreenContainer } from '@/shared/components';
import { colors, fontSize, palette, screen } from '@/theme';

import { useRemoveLikeMutation } from '@/features/matches';
import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';

import { DistanceRangeSlider } from '../components/DistanceRangeSlider';
import { FreeTonightCard } from '../components/FreeTonightCard';
import {
  useGetMyTonightQuery,
  useGetTonightInfiniteQuery,
} from '../api/tonightApi';
import {
  FREE_TONIGHT_FILTERS,
  type FreeTonightActivity,
  type FreeTonightPerson,
} from '../data/mockFreeTonight';
import { useSwipeAndMatch } from '../hooks/useSwipeAndMatch';

const ACCENT = '#FF2D8A';
const CHIP_IDLE = '#1A2540';
const CARD_GAP = 10;
const CARD_PAD = 16;
const CARD_WIDTH = (screen.width - CARD_PAD * 2 - CARD_GAP) / 2;
const DISTANCE_MIN = 0;
const DISTANCE_MAX = 150;

type FilterKey = 'all' | FreeTonightActivity;

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [delay, value]);
  return debounced;
}

export function FreeTonightScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [rangeLow, setRangeLow] = useState(DISTANCE_MIN);
  const [rangeHigh, setRangeHigh] = useState(50);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const minKm = useDebouncedValue(rangeLow, 280);
  const maxKm = useDebouncedValue(rangeHigh, 280);
  const tonightQuery = useMemo(
    () => ({
      activity: filter === 'all' ? undefined : filter,
      minKm,
      maxKm,
    }),
    [filter, maxKm, minKm],
  );
  const {
    data,
    isFetching,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetTonightInfiniteQuery(tonightQuery);
  const { data: mine } = useGetMyTonightQuery();
  const { data: me } = useGetMyProfileQuery();
  const people = useMemo(() => {
    const myId = me?.id;
    return flatPageItems(data).filter(item => {
      if (item.isOwn) {
        return false;
      }
      if (myId && (item.userId === myId || item.id === myId)) {
        return false;
      }
      return true;
    });
  }, [data, me?.id]);
  const [swipe] = useSwipeAndMatch();
  const [removeLike] = useRemoveLikeMutation();

  useEffect(() => {
    const next = people.filter(item => item.liked).map(item => item.id);
    setLikedIds(current =>
      current.length === next.length &&
      current.every((id, index) => id === next[index])
        ? current
        : next,
    );
  }, [people]);

  const toggleLike = (person: FreeTonightPerson) => {
    const userId = person.userId ?? person.id;
    const liked = likedIds.includes(person.id);
    setLikedIds(current =>
      liked
        ? current.filter(item => item !== person.id)
        : [...current, person.id],
    );
    if (liked) {
      void removeLike(userId);
      return;
    }
    void swipe({ targetUserId: userId, action: 'like' });
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
        >
          <Icon name="calendar-outline" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('freeTonight.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            mine ? t('freeTonight.myTonight') : t('freeTonight.add')
          }
          onPress={() => navigation.navigate('CreateFreeTonight')}
          style={mine ? styles.meBtn : styles.addBtn}
        >
          {mine?.photo ? (
            <Image source={{ uri: mine.photo }} style={styles.mePhoto} />
          ) : (
            <Icon
              name={mine ? 'person' : 'add'}
              size={22}
              color={mine ? palette.white : palette.black}
            />
          )}
        </Pressable>
      </View>

      <FlatList
        data={people}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onEndReached={() =>
          loadMoreIfNeeded({ hasNextPage, isFetchingNextPage, fetchNextPage })
        }
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FREE_TONIGHT_FILTERS.map(item => {
                const selected = filter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(item.key)}
                    style={[styles.chip, selected && styles.chipOn]}
                  >
                    {item.emoji ? (
                      <Text style={styles.chipEmoji}>{item.emoji}</Text>
                    ) : null}
                    <Text
                      style={[styles.chipLabel, selected && styles.chipLabelOn]}
                    >
                      {t(item.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.distanceCard}>
              <View style={styles.distanceHeader}>
                <View style={styles.distanceTitleRow}>
                  <Icon name="location" size={14} color={ACCENT} />
                  <Text style={styles.distanceTitle}>
                    {t('freeTonight.distance')}
                  </Text>
                </View>
                <Text style={styles.distanceValue}>
                  {t('freeTonight.rangeValue', {
                    low: rangeLow,
                    high: rangeHigh,
                  })}
                </Text>
              </View>
              <DistanceRangeSlider
                min={DISTANCE_MIN}
                max={DISTANCE_MAX}
                low={rangeLow}
                high={rangeHigh}
                onChange={(low, high) => {
                  setRangeLow(low);
                  setRangeHigh(high);
                }}
              />
              <View style={styles.distanceEnds}>
                <Text style={styles.distanceEnd}>
                  {t('freeTonight.km', { value: DISTANCE_MIN })}
                </Text>
                <Text style={styles.distanceEnd}>
                  {t('freeTonight.km', { value: DISTANCE_MAX })}
                </Text>
              </View>
            </View>
            {isLoading || (isFetching && people.length === 0) ? (
              <View style={styles.empty}>
                <ActivityIndicator color={ACCENT} />
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <InfiniteListFooter loading={isFetchingNextPage} />
        }
        ListEmptyComponent={
          isLoading || isFetching ? null : (
            <View style={styles.empty}>
              <Icon name="moon-outline" size={28} color={ACCENT} />
              <Text style={styles.emptyTitle}>{t('freeTonight.emptyTitle')}</Text>
              <Text style={styles.emptyHint}>{t('freeTonight.emptyHint')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <FreeTonightCard
            person={item}
            width={CARD_WIDTH}
            liked={likedIds.includes(item.id)}
            onPress={() =>
              navigation.navigate('FreeTonightDetail', {
                personId: item.id,
              })
            }
            onToggleLike={() => toggleLike(item)}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#151515',
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mePhoto: {
    width: '100%',
    height: '100%',
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(28),
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  scroll: {
    paddingBottom: 32,
  },
  filters: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: CHIP_IDLE,
  },
  chipOn: {
    backgroundColor: ACCENT,
  },
  chipEmoji: {
    fontSize: fontSize(13),
  },
  chipLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  chipLabelOn: {
    color: palette.white,
  },
  distanceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 18,
    backgroundColor: '#141B2D',
    borderWidth: 1,
    borderColor: '#1F2A44',
    gap: 8,
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  distanceValue: {
    color: '#9AA4B8',
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  distanceEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distanceEnd: {
    color: '#9AA4B8',
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  row: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
    paddingHorizontal: CARD_PAD,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 18,
  },
});
