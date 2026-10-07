import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { useGetDiscoveryFeedInfiniteQuery } from '@/features/discovery/api/discoveryApi';
import { useAudienceFiltered } from '@/features/discovery/hooks/useAudienceFiltered';
import { useSwipeAndMatch } from '@/features/discovery/hooks/useSwipeAndMatch';
import type { DiscoveryCandidate } from '@/features/discovery/types';
import type { RootStackParamList } from '@/navigation/types';
import { Icon, InfiniteListFooter, ScreenContainer, type IconName } from '@/shared/components';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';
import { colors, fontSize, palette, screen } from '@/theme';

import { RELATIONSHIP_GOAL_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { RelationshipGoal } from '@/features/profile/types';

import { BrowseProfileCard } from '../components/BrowseProfileCard';
import { FilterPickerSheet } from '../components/FilterPickerSheet';
import { PreferenceIcon } from '../components/PreferenceIcon';
import { countryCodeForName } from '../data/geoHierarchy';
import { flagUrl } from '../data/journeyLocations';
import { homeAccent } from '../theme';

const GAP = 10;
const PAD = 14;
const COLS = 2;
const CARD_WIDTH = (screen.width - PAD * 2 - GAP) / COLS;

type BrowseMode = 'everyone' | 'new' | 'active' | 'verified';
type ChipKey = 'all' | 'nearby' | 'looking' | 'recommend' | 'nationality';

type Chip = {
  key: ChipKey;
  label:
    | 'browse.chips.all'
    | 'browse.chips.nearby'
    | 'browse.chips.lookingFor'
    | 'browse.chips.recommend'
    | 'browse.chips.nationality';
  icon: IconName;
  dropdown?: boolean;
};

const CHIPS: Chip[] = [
  { key: 'all', label: 'browse.chips.all', icon: 'grid-outline' },
  { key: 'nearby', label: 'browse.chips.nearby', icon: 'location-outline' },
  {
    key: 'looking',
    label: 'browse.chips.lookingFor',
    icon: 'heart-outline',
    dropdown: true,
  },
  {
    key: 'recommend',
    label: 'browse.chips.recommend',
    icon: 'sparkles-outline',
  },
  {
    key: 'nationality',
    label: 'browse.chips.nationality',
    icon: 'globe-outline',
    dropdown: true,
  },
];

const TITLE_KEY: Record<
  BrowseMode,
  'home.everyone' | 'home.new' | 'home.active' | 'home.verified'
> = {
  everyone: 'home.everyone',
  new: 'home.new',
  active: 'home.active',
  verified: 'home.verified',
};

export function BrowseEveryoneScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'BrowseEveryone'>>();
  const mode: BrowseMode = route.params?.mode ?? 'everyone';
  const showFilters = mode === 'everyone';

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetDiscoveryFeedInfiniteQuery({ segment: mode });
  const [swipe] = useSwipeAndMatch();
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipKey>('all');
  const [lookingFor, setLookingFor] = useState<RelationshipGoal | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [filterSheet, setFilterSheet] = useState<
    'looking' | 'nationality' | null
  >(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);

  const feedItems = useMemo(
    () => flatPageItems(data),
    [data],
  );
  const items = useAudienceFiltered(feedItems);

  const lookingForOptions = useMemo(() => {
    const present = new Set(
      items
        .map(item => item.relationshipGoal)
        .filter((value): value is RelationshipGoal => Boolean(value)),
    );
    const source = present.size
      ? RELATIONSHIP_GOAL_OPTIONS.filter(item => present.has(item.value))
      : RELATIONSHIP_GOAL_OPTIONS;
    return source.map(item => ({
      id: item.value,
      label: t(`profileOptions.relationshipGoal.${item.value}.title`),
    }));
  }, [items, t]);

  const nationalityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      const name = (item.nationality || item.country || '').trim();
      if (!name || seen.has(name)) {
        continue;
      }
      const code = countryCodeForName(name);
      seen.set(name, code ? flagUrl(code) : '');
    }
    return [...seen.entries()]
      .map(([id, image]) => ({
        id,
        label: id,
        flagUrl: image || undefined,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;

    if (mode === 'new') {
      list = list.filter(item => item.isNew);
    } else if (mode === 'active') {
      list = list.filter(item => item.isOnline);
    } else if (mode === 'verified') {
      list = list.filter(item => item.isVerified);
    } else if (chip === 'nearby') {
      list = [...list].sort(
        (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999),
      );
    } else if (chip === 'recommend') {
      list = list.filter(item => item.isNew || item.isVerified);
    } else if (chip === 'looking') {
      list = lookingFor
        ? list.filter(item => item.relationshipGoal === lookingFor)
        : list.filter(item => item.relationshipGoal != null);
    } else if (chip === 'nationality') {
      list = nationality
        ? list.filter(
            item =>
              item.country === nationality ||
              item.nationality === nationality,
          )
        : list.filter(item => Boolean(item.country || item.nationality));
    }

    if (!q) {
      return list;
    }

    return list.filter(item => {
      const haystack = [item.name, String(item.age), item.city, item.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [chip, items, lookingFor, mode, nationality, query]);

  const toggleLike = (profile: DiscoveryCandidate) => {
    const liked = likedIds.includes(profile.id);
    setLikedIds(current =>
      liked
        ? current.filter(id => id !== profile.id)
        : [...current, profile.id],
    );
    if (!liked) {
      swipe({ targetUserId: profile.id, action: 'like' });
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.brandRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t(TITLE_KEY[mode])}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Icon name="search" size={18} color={palette.gray400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('browse.searchPlaceholder')}
            placeholderTextColor={palette.gray400}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        {showFilters ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('browse.filters')}
            onPress={() => navigation.navigate('DiscoveryPreferences')}
            style={styles.filterBtn}
          >
            <PreferenceIcon size={18} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      {showFilters ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CHIPS.map(item => {
            const selected = chip === item.key;
            const label =
              item.key === 'looking' && lookingFor
                ? t(`profileOptions.relationshipGoal.${lookingFor}.title`)
                : item.key === 'nationality' && nationality
                  ? nationality
                  : t(item.label);
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (item.key === 'looking') {
                    setChip('looking');
                    setFilterSheet('looking');
                    return;
                  }
                  if (item.key === 'nationality') {
                    setChip('nationality');
                    setFilterSheet('nationality');
                    return;
                  }
                  setLookingFor(null);
                  setNationality(null);
                  setChip(item.key);
                }}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Icon
                  name={item.icon}
                  size={14}
                  color={selected ? homeAccent.cyan : colors.textPrimary}
                />
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {label}
                </Text>
                {item.dropdown ? (
                  <Icon
                    name="chevron-down"
                    size={12}
                    color={selected ? homeAccent.cyan : palette.gray300}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading && filtered.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={COLS}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          onEndReached={() =>
            loadMoreIfNeeded({ hasNextPage, isFetchingNextPage, fetchNextPage })
          }
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <InfiniteListFooter loading={isFetchingNextPage} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('browse.emptyTitle')}</Text>
              <Text style={styles.emptyHint}>{t('browse.emptyHint')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <BrowseProfileCard
              profile={item}
              width={CARD_WIDTH}
              liked={likedIds.includes(item.id)}
              onPress={() =>
                navigation.navigate('UserProfile', { userId: item.id })
              }
              onLike={() => toggleLike(item)}
            />
          )}
        />
      )}

      <FilterPickerSheet
        visible={filterSheet === 'looking'}
        title={t('browse.chips.lookingFor')}
        options={lookingForOptions}
        selected={lookingFor}
        onClose={() => setFilterSheet(null)}
        onSelect={id => {
          const next = id as RelationshipGoal;
          setLookingFor(current => (current === next ? null : next));
          setChip('looking');
        }}
      />
      <FilterPickerSheet
        visible={filterSheet === 'nationality'}
        title={t('browse.chips.nationality')}
        options={nationalityOptions}
        selected={nationality}
        onClose={() => setFilterSheet(null)}
        onSelect={id => {
          setNationality(current => (current === id ? null : id));
          setChip('nationality');
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: palette.white,
    fontSize: fontSize(20),
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: PAD,
    paddingTop: 4,
    paddingBottom: 12,
  },
  searchField: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: palette.gray850,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    paddingVertical: 0,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    paddingHorizontal: PAD,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: palette.gray850,
  },
  chipOn: {
    borderColor: 'rgba(46,230,214,0.7)',
    backgroundColor: 'rgba(46,230,214,0.08)',
    shadowColor: homeAccent.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  chipTextOn: {
    color: homeAccent.cyan,
  },
  list: {
    paddingHorizontal: PAD,
    paddingBottom: 40,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingTop: 64,
    paddingHorizontal: 24,
    alignItems: 'center',
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
    fontSize: fontSize(14),
    textAlign: 'center',
  },
});
