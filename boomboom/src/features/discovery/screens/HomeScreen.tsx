import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useGetDiscoveryFeedInfiniteQuery } from '@/features/discovery/api/discoveryApi';
import type { DiscoveryCandidate } from '@/features/discovery/types';
import { useGetUnreadNotificationCountQuery } from '@/features/notifications/api/notificationsApi';
import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';
import { ScreenContainer } from '@/shared/components';
import { showSuccessAlert } from '@/shared/utils/alerts';
import { displayPlaceName } from '@/shared/utils/placeName';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { flatPageItems } from '@/shared/utils/pagination';
import { colors, screen } from '@/theme';

import {
  refreshCurrentLocation,
  useLocationSyncStatus,
} from '../hooks/useHomeLocation';

import {
  ActiveVerifiedTabs,
  type ActiveVerifiedTab,
} from '../components/ActiveVerifiedTabs';
import { HomeHeader } from '../components/HomeHeader';
import { HomePromoCards } from '../components/HomePromoCards';
import { ProfileTile } from '../components/ProfileTile';
import { SectionPill } from '../components/SectionPill';
import { SeeAllCard } from '../components/SeeAllCard';

const RAIL_GAP = 10;
const RAIL_PADDING = 16;
const RAIL_TILE_WIDTH = screen.width * 0.42;
const RAIL_PREVIEW = 5;
const EVERYONE_COLS = 3;
const EVERYONE_GAP = 4;
const EVERYONE_PADDING = 6;
const EVERYONE_TILE_WIDTH = Math.floor(
  (screen.width -
    EVERYONE_PADDING * 2 -
    EVERYONE_GAP * (EVERYONE_COLS - 1)) /
    EVERYONE_COLS,
);

type BrowseMode = 'everyone' | 'new' | 'active' | 'verified';

type ProfileRailProps = {
  profiles: DiscoveryCandidate[];
  keyPrefix: string;
  onOpenProfile: (userId: string) => void;
  onSeeMore: () => void;
  seeMoreLabel: string;
};

function ProfileRail({
  profiles,
  keyPrefix,
  onOpenProfile,
  onSeeMore,
  seeMoreLabel,
}: ProfileRailProps) {
  const preview = profiles.slice(0, RAIL_PREVIEW);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {preview.map(profile => (
        <ProfileTile
          key={`${keyPrefix}-${profile.id}`}
          profile={profile}
          width={RAIL_TILE_WIDTH}
          onPress={() => onOpenProfile(profile.id)}
        />
      ))}
      <SeeAllCard
        width={RAIL_TILE_WIDTH}
        label={seeMoreLabel}
        onPress={onSeeMore}
      />
    </ScrollView>
  );
}

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { data: me } = useGetMyProfileQuery();
  const locationStatus = useLocationSyncStatus();
  const placeLabel = displayPlaceName(me ?? {});
  const fetchingLocation =
    locationStatus === 'fetching' || locationStatus === 'refreshing';
  const { data: unreadCount = 0 } = useGetUnreadNotificationCountQuery();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useGetDiscoveryFeedInfiniteQuery();
  const [activeVerifiedTab, setActiveVerifiedTab] =
    useState<ActiveVerifiedTab>('active');

  const items = useMemo(
    () => flatPageItems(data),
    [data],
  );
  const newProfiles = useMemo(
    () => items.filter(item => item.isNew),
    [items],
  );
  const everyone = items;
  const activeProfiles = useMemo(
    () => items.filter(item => item.isOnline),
    [items],
  );
  const verifiedProfiles = useMemo(
    () => items.filter(item => item.isVerified),
    [items],
  );
  const activeVerifiedProfiles =
    activeVerifiedTab === 'active' ? activeProfiles : verifiedProfiles;
  const showActiveVerified =
    activeProfiles.length > 0 || verifiedProfiles.length > 0;

  useEffect(() => {
    if (!isFetching && !isFetchingNextPage && hasNextPage && items.length < 40) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, items.length]);

  const openProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const openBrowse = (mode: BrowseMode) => {
    navigation.navigate('BrowseEveryone', { mode });
  };

  return (
    <ScreenContainer edges={['top']}>
      <HomeHeader
        city={
          fetchingLocation
            ? t('home.fetchingLocation')
            : placeLabel || t('home.defaultCity')
        }
        flagUrl={profileFlagUrl(me ?? {})}
        fetching={fetchingLocation}
        avatarUrl={me?.photos?.[0]?.url}
        unreadCount={unreadCount}
        onPressLocation={() => {
          void (async () => {
            try {
              const place = await refreshCurrentLocation();
              showSuccessAlert(
                place
                  ? t('home.locationUpdated', { place })
                  : t('home.locationUpdatedGeneric'),
              );
            } catch {
              Alert.alert(t('common.error'), t('home.locationFailed'));
            }
          })();
        }}
        onPressAvatar={() => navigation.navigate('Settings')}
        onPressAlerts={() => navigation.navigate('Notifications')}
        onPressFilters={() => navigation.navigate('DiscoveryPreferences')}
      />

      {isLoading && items.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <HomePromoCards
            onPressTravel={() => navigation.navigate('TravelAlert')}
            onPressFreelance={() => navigation.navigate('FreeTonight')}
          />

          {!isLoading && items.length === 0 ? (
            <View style={styles.emptyFeed}>
              <SectionPill
                title={t('home.emptyFeedTitle')}
                subtitle={t('home.emptyFeedHint')}
                icon="people-outline"
              />
            </View>
          ) : null}

          {newProfiles.length > 0 ? (
            <View style={styles.block}>
              <View style={styles.section}>
                <SectionPill
                  title={t('home.new')}
                  subtitle={t('home.newSubtitle')}
                  icon="flame-outline"
                  showArrow
                  onPress={() => openBrowse('new')}
                />
              </View>
              <ProfileRail
                profiles={newProfiles}
                keyPrefix="new"
                onOpenProfile={openProfile}
                onSeeMore={() => openBrowse('new')}
                seeMoreLabel={t('home.seeMore')}
              />
            </View>
          ) : null}

          {showActiveVerified ? (
            <View style={styles.block}>
              <ActiveVerifiedTabs
                active={activeVerifiedTab}
                onChange={setActiveVerifiedTab}
              />
              <ProfileRail
                profiles={activeVerifiedProfiles}
                keyPrefix={activeVerifiedTab}
                onOpenProfile={openProfile}
                onSeeMore={() => openBrowse(activeVerifiedTab)}
                seeMoreLabel={t('home.seeMore')}
              />
            </View>
          ) : null}

          {everyone.length > 0 ? (
            <View style={styles.block}>
              <View style={styles.section}>
                <SectionPill
                  title={t('home.everyone')}
                  subtitle={t('home.everyoneSubtitle')}
                  icon="person-outline"
                  showArrow
                  onPress={() => openBrowse('everyone')}
                />
              </View>
              <View style={styles.everyoneGrid}>
                {everyone.slice(0, 11).map((profile, index) => (
                  <View
                    key={`everyone-${profile.id}`}
                    style={[
                      styles.everyoneCell,
                      (index + 1) % EVERYONE_COLS === 0 &&
                        styles.everyoneCellLast,
                    ]}
                  >
                    <ProfileTile
                      profile={profile}
                      width={EVERYONE_TILE_WIDTH}
                      onPress={() => openProfile(profile.id)}
                    />
                  </View>
                ))}
                <View
                  style={[
                    styles.everyoneCell,
                    (everyone.slice(0, 11).length + 1) % EVERYONE_COLS === 0 &&
                      styles.everyoneCellLast,
                  ]}
                >
                  <SeeAllCard
                    width={EVERYONE_TILE_WIDTH}
                    onPress={() => openBrowse('everyone')}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 110,
    gap: 16,
  },
  emptyFeed: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  block: {
    gap: 16,
  },
  section: {
    marginTop: 4,
  },
  rail: {
    paddingHorizontal: RAIL_PADDING,
    gap: RAIL_GAP,
  },
  everyoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: EVERYONE_PADDING,
  },
  everyoneCell: {
    width: EVERYONE_TILE_WIDTH,
    marginRight: EVERYONE_GAP,
    marginBottom: EVERYONE_GAP,
  },
  everyoneCellLast: {
    marginRight: 0,
  },
});
