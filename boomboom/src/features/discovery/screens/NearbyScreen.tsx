import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Circle,
  Marker,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetDiscoveryMapInfiniteQuery } from '@/features/discovery/api/discoveryApi';
import {
  getLastKnownCoords,
  noteDeviceCoords,
  refreshCurrentLocation,
  useLastKnownCoords,
  useLocationSyncStatus,
} from '@/features/discovery/hooks/useHomeLocation';
import { useSwipeAndMatch } from '@/features/discovery/hooks/useSwipeAndMatch';
import type { DiscoveryCandidate } from '@/features/discovery/types';
import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';
import { reverseGeocodePlace } from '@/services/maps/googlePlaces';
import { Icon, InfiniteListFooter } from '@/shared/components';
import { displayPlaceName } from '@/shared/utils/placeName';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';
import { formatKm } from '@/shared/utils/safeValue';
import { colors, fontSize, palette, screen } from '@/theme';

import { MapBottomCard } from '../components/MapBottomCard';
import { MapMarkerPin } from '../components/MapMarkerPin';
import {
  MapPeopleTabs,
  type MapPeopleFilter,
} from '../components/MapPeopleTabs';
import { MapSearchBar } from '../components/MapSearchBar';
import { NearbyPreviewCard } from '../components/NearbyPreviewCard';
import { homeAccent } from '../theme';
import { GOOGLE_MAP_NIGHT_STYLE } from '../utils/googleMapStyle';
import { mapCardKindForProfile } from '../utils/mapCardKind';
import {
  coordinateForPerson,
  NEARBY_RADII_KM,
  regionForPin,
  regionFromRadius,
  type MapCoord,
} from '../utils/mapPins';

const TAB_BAR_HEIGHT = 64;
const MAP_CARD_GAP = 10;
const MAP_CARD_PADDING = 14;
const MAP_CARD_WIDTH =
  (screen.width - MAP_CARD_PADDING * 2 - MAP_CARD_GAP * 2) / 3;
const MAP_CARD_META = 42;
const MAP_CARD_HEIGHT = MAP_CARD_WIDTH + MAP_CARD_META;
const FILTER_BAR_HEIGHT = 64;
const SHEET_CHROME = FILTER_BAR_HEIGHT + 28;
const SHEET_COLLAPSED_HEIGHT = SHEET_CHROME + MAP_CARD_HEIGHT;
const SHEET_EXPANDED_HEIGHT =
  SHEET_CHROME + MAP_CARD_HEIGHT * 2 + MAP_CARD_GAP;

export function NearbyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const ignoreMapPress = useRef(false);
  const { data: me } = useGetMyProfileQuery();
  const deviceCoords = useLastKnownCoords();
  const locationStatus = useLocationSyncStatus();
  const [swipe] = useSwipeAndMatch();
  const [radiusKm, setRadiusKm] = useState<(typeof NEARBY_RADII_KM)[number]>(10);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<MapPeopleFilter>('all');
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [searchPin, setSearchPin] = useState<MapCoord | null>(null);
  const [searchLabel, setSearchLabel] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const radiusRef = useRef(radiusKm);
  radiusRef.current = radiusKm;
  const searchPinRef = useRef<MapCoord | null>(null);
  searchPinRef.current = searchPin;
  const center = searchPin ?? deviceCoords;
  const locating = center == null && locationStatus !== 'error';
  const gpsError = center == null && locationStatus === 'error';
  const city = searchPin
    ? searchLabel
    : displayPlaceName(me ?? {});

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetDiscoveryMapInfiniteQuery(
    {
      latitude: center?.latitude ?? 0,
      longitude: center?.longitude ?? 0,
      radiusKm,
      kind: mapFilter,
      onlineOnly,
    },
    { skip: center == null },
  );

  const sheetHeight = useSharedValue(SHEET_COLLAPSED_HEIGHT);
  const dragStartHeight = useSharedValue(SHEET_COLLAPSED_HEIGHT);

  const tabClearance = Math.max(insets.bottom, 10) + TAB_BAR_HEIGHT + 14;
  const mapSheetHeight = sheetExpanded
    ? SHEET_EXPANDED_HEIGHT
    : SHEET_COLLAPSED_HEIGHT;
  const bottomPad = listMode
    ? tabClearance
    : tabClearance + mapSheetHeight;

  const setExpandedState = useCallback((expanded: boolean) => {
    setSheetExpanded(expanded);
  }, []);

  const snapSheet = useCallback(
    (expanded: boolean) => {
      'worklet';
      sheetHeight.value = withSpring(
        expanded ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT,
        { damping: 22, stiffness: 220 },
      );
      runOnJS(setExpandedState)(expanded);
    },
    [setExpandedState, sheetHeight],
  );

  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .onBegin(() => {
          dragStartHeight.value = sheetHeight.value;
        })
        .onUpdate(event => {
          const next = dragStartHeight.value - event.translationY;
          sheetHeight.value = Math.min(
            SHEET_EXPANDED_HEIGHT,
            Math.max(SHEET_COLLAPSED_HEIGHT, next),
          );
        })
        .onEnd(event => {
          const mid = (SHEET_COLLAPSED_HEIGHT + SHEET_EXPANDED_HEIGHT) / 2;
          const shouldExpand =
            event.velocityY < -400 ||
            (event.velocityY <= 400 && sheetHeight.value > mid);
          snapSheet(shouldExpand);
        }),
    [dragStartHeight, sheetHeight, snapSheet],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const flyToCenter = useCallback((coord: MapCoord, km = radiusRef.current) => {
    mapRef.current?.animateToRegion(regionFromRadius(coord, km), 400);
  }, []);

  useEffect(() => {
    if (!deviceCoords) {
      void refreshCurrentLocation().catch(() => undefined);
    }
  }, [deviceCoords]);

  useEffect(() => {
    if (searchPin || !deviceCoords) {
      return;
    }
    flyToCenter(deviceCoords);
  }, [deviceCoords, flyToCenter, searchPin]);

  const applySearch = async (next: MapCoord, label?: string) => {
    setSearchPin(next);
    setSearchLabel(label ?? '');
    flyToCenter(next);
    if (label) {
      return;
    }
    try {
      const resolved = await reverseGeocodePlace(next.latitude, next.longitude);
      const place = displayPlaceName(resolved);
      if (place) {
        setSearchLabel(place);
      }
    } catch {
      setSearchLabel(label ?? '');
    }
  };

  const lockToDevice = async () => {
    setSearchPin(null);
    setSearchLabel('');
    setSelectedId(null);
    await refreshCurrentLocation().catch(() => undefined);
    const coords = getLastKnownCoords();
    if (coords) {
      flyToCenter(coords);
    }
  };

  const people = useMemo(() => flatPageItems(data), [data]);

  useEffect(() => {
    if (center == null || listMode) {
      return;
    }
    if (people.length < 60 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [
    center,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    listMode,
    people.length,
  ]);

  const peopleWithKind = useMemo(
    () =>
      people.map((profile, index) => ({
        profile,
        kind: mapCardKindForProfile(profile, index),
      })),
    [people],
  );

  const filteredPeople = useMemo(() => {
    if (mapFilter === 'all') {
      return peopleWithKind;
    }
    return peopleWithKind.filter(item => item.kind === mapFilter);
  }, [mapFilter, peopleWithKind]);

  const pins = useMemo(
    () =>
      center
        ? filteredPeople.map(({ profile }) => ({
            profile,
            coordinate: coordinateForPerson(profile, center),
          }))
        : [],
    [center, filteredPeople],
  );

  useEffect(() => {
    if (selectedId && !filteredPeople.some(item => item.profile.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredPeople, selectedId]);

  const selected =
    filteredPeople.find(item => item.profile.id === selectedId)?.profile ??
    null;

  const toggleLike = (profile: DiscoveryCandidate) => {
    setLikedIds(current =>
      current.includes(profile.id)
        ? current.filter(id => id !== profile.id)
        : [...current, profile.id],
    );
    swipe({ targetUserId: profile.id, action: 'like' });
  };

  const selectPerson = (id: string) => {
    ignoreMapPress.current = true;
    Keyboard.dismiss();
    setSelectedId(id);
    const pin = pins.find(item => item.profile.id === id);
    if (pin) {
      mapRef.current?.animateToRegion(regionForPin(pin.coordinate), 380);
    }
  };

  const changeRadius = (value: (typeof NEARBY_RADII_KM)[number]) => {
    setRadiusKm(value);
    setSelectedId(null);
    if (center) {
      flyToCenter(center, value);
    }
  };

  const recenter = async () => {
    Keyboard.dismiss();
    await lockToDevice();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {!listMode ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={GOOGLE_MAP_NIGHT_STYLE}
          initialRegion={
            center
              ? regionFromRadius(center, radiusKm)
              : {
                  latitude: 0,
                  longitude: 0,
                  latitudeDelta: 80,
                  longitudeDelta: 80,
                }
          }
          showsUserLocation
          followsUserLocation={center == null && !searchPin}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          userInterfaceStyle="dark"
          mapPadding={{
            top: insets.top + 118,
            right: 16,
            bottom: bottomPad,
            left: 16,
          }}
          onUserLocationChange={event => {
            if (searchPinRef.current) {
              return;
            }
            const coord = event.nativeEvent.coordinate;
            if (coord == null) {
              return;
            }
            noteDeviceCoords({
              latitude: coord.latitude,
              longitude: coord.longitude,
            });
          }}
          onPress={() => {
            if (ignoreMapPress.current) {
              ignoreMapPress.current = false;
              return;
            }
            Keyboard.dismiss();
            setSelectedId(null);
          }}
        >
          {center ? (
            <Circle
              center={center}
              radius={radiusKm * 1000}
              strokeColor="rgba(59, 130, 246, 0.55)"
              fillColor="rgba(59, 130, 246, 0.12)"
              strokeWidth={1.5}
            />
          ) : null}

          {searchPin ? (
            <Marker
              coordinate={searchPin}
              pinColor="red"
              zIndex={20}
              title={city || undefined}
            />
          ) : null}

          {pins.map(({ profile, coordinate }) => (
            <Marker
              key={profile.id}
              coordinate={coordinate}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={selected?.id === profile.id ? 8 : 1}
              title={profile.name}
              description={
                profile.distanceKm != null
                  ? `${formatKm(profile.distanceKm)} km`
                  : undefined
              }
              onPress={() => selectPerson(profile.id)}
            >
              <MapMarkerPin
                profile={profile}
                selected={selected?.id === profile.id}
              />
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={styles.listBackdrop} />
      )}

      <View
        pointerEvents="box-none"
        style={[styles.chrome, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.searchRow}>
          {!listMode ? (
            <MapSearchBar
              bias={center}
              onPlaceSelected={place => {
                const next = {
                  latitude: place.latitude,
                  longitude: place.longitude,
                };
                setSelectedId(null);
                if (radiusKm < 10) {
                  setRadiusKm(10);
                }
                void applySearch(next, place.name);
              }}
            />
          ) : (
            <View style={styles.listTitleWrap}>
              <Text style={styles.listTitle}>{t('nearby.title')}</Text>
              <Text style={styles.listSubtitle}>
                {t('nearby.peopleAround', { count: people.length, city })}
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nearby.onlineOnly')}
            onPress={() => setOnlineOnly(value => !value)}
            style={[styles.iconBtn, onlineOnly && styles.iconBtnOn]}
          >
            <View style={styles.liveDot} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(listMode ? 'nearby.showMap' : 'nearby.showList')}
            onPress={() => {
              Keyboard.dismiss();
              setSelectedId(null);
              setListMode(value => !value);
            }}
            style={styles.iconBtn}
          >
            <Icon
              name={listMode ? 'map-outline' : 'list-outline'}
              size={18}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.chips, styles.chipsGrow]}>
            {NEARBY_RADII_KM.map(value => {
              const active = value === radiusKm;
              return (
                <Pressable
                  key={value}
                  onPress={() => changeRadius(value)}
                  style={[styles.chip, active && styles.chipOn]}
                >
                  <Text
                    style={[styles.chipLabel, active && styles.chipLabelOn]}
                  >
                    {t('nearby.radius', { km: value })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {!listMode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nearby.recenter')}
          onPress={recenter}
          style={[styles.recenter, { bottom: bottomPad + 8 }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={homeAccent.yellow} />
          ) : (
            <Icon name="navigate" size={18} color={homeAccent.yellow} />
          )}
        </Pressable>
      ) : null}

      {listMode ? (
        <FlatList
          data={people}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: tabClearance + 8 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={() =>
            loadMoreIfNeeded({ hasNextPage, isFetchingNextPage, fetchNextPage })
          }
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <InfiniteListFooter loading={isFetchingNextPage} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="location-outline" size={28} color={homeAccent.yellow} />
              <Text style={styles.emptyTitle}>{t('nearby.emptyTitle')}</Text>
              <Text style={styles.emptyHint}>{t('nearby.emptyHint')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <NearbyPreviewCard
              profile={item}
              liked={likedIds.includes(item.id)}
              onPress={() =>
                navigation.navigate('UserProfile', { userId: item.id })
              }
              onLike={() => toggleLike(item)}
            />
          )}
        />
      ) : (
        <Animated.View
          style={[
            styles.mapSheet,
            { bottom: tabClearance },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={sheetPan}>
            <View style={styles.sheetDragArea}>
              <View style={styles.sheetHandle} />
              <MapPeopleTabs active={mapFilter} onChange={setMapFilter} />
            </View>
          </GestureDetector>
          {filteredPeople.length === 0 ? (
            <View style={styles.mapEmpty}>
              <Text style={styles.emptyTitle}>{t('nearby.emptyTitle')}</Text>
              <Text style={styles.emptyHint}>{t('nearby.emptyHint')}</Text>
            </View>
          ) : sheetExpanded ? (
            <FlatList
              data={filteredPeople}
              keyExtractor={item => item.profile.id}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.mapSheetList}
              columnWrapperStyle={styles.mapGridRow}
              onEndReached={() =>
                loadMoreIfNeeded({
                  hasNextPage,
                  isFetchingNextPage,
                  fetchNextPage,
                })
              }
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                <InfiniteListFooter loading={isFetchingNextPage} />
              }
              renderItem={({ item: { profile } }) => (
                <MapBottomCard
                  profile={profile}
                  width={MAP_CARD_WIDTH}
                  selected={selected?.id === profile.id}
                  onPress={() => {
                    selectPerson(profile.id);
                    navigation.navigate('UserProfile', { userId: profile.id });
                  }}
                />
              )}
            />
          ) : (
            <GestureDetector gesture={sheetPan}>
              <View style={styles.mapGrid}>
                {filteredPeople.slice(0, 3).map(({ profile }) => (
                  <MapBottomCard
                    key={profile.id}
                    profile={profile}
                    width={MAP_CARD_WIDTH}
                    selected={selected?.id === profile.id}
                    onPress={() => {
                      selectPerson(profile.id);
                      navigation.navigate('UserProfile', {
                        userId: profile.id,
                      });
                    }}
                  />
                ))}
              </View>
            </GestureDetector>
          )}
        </Animated.View>
      )}
      {gpsError && !listMode ? (
        <View pointerEvents="box-none" style={styles.gpsBanner}>
          <View style={styles.gpsError}>
            <Text style={styles.emptyTitle}>
              {t('nearby.locationErrorTitle')}
            </Text>
            <Text style={styles.emptyHint}>
              {t('nearby.locationErrorHint')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void lockToDevice()}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>{t('nearby.retryLocation')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1014',
  },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  listBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
  },
  chrome: {
    zIndex: 30,
    elevation: 30,
    paddingHorizontal: 16,
    overflow: 'visible',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 30,
    overflow: 'visible',
  },
  listTitleWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  listTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(26),
    fontWeight: '800',
  },
  listSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(12,12,12,0.92)',
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: {
    borderColor: homeAccent.cyan,
    backgroundColor: '#102420',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chipsGrow: {
    justifyContent: 'flex-start',
  },
  chip: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(12,12,12,0.88)',
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: homeAccent.yellow,
    backgroundColor: '#1A1600',
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  chipLabelOn: {
    color: colors.textPrimary,
  },
  recenter: {
    position: 'absolute',
    right: 16,
    zIndex: 5,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(12,12,12,0.92)',
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 180,
    zIndex: 6,
    alignItems: 'center',
  },
  gpsError: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(12,12,12,0.92)',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 12,
    backgroundColor: homeAccent.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#111111',
    fontSize: fontSize(14),
    fontWeight: '800',
  },
  mapSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: '#0B0B0B',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: palette.gray750,
  },
  sheetDragArea: {
    paddingBottom: 2,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
    marginTop: 8,
    marginBottom: 2,
  },
  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: MAP_CARD_PADDING,
    paddingTop: 8,
    paddingBottom: 12,
    gap: MAP_CARD_GAP,
  },
  mapGridRow: {
    gap: MAP_CARD_GAP,
    paddingHorizontal: MAP_CARD_PADDING,
    marginBottom: MAP_CARD_GAP,
  },
  mapSheetList: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  mapEmpty: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  list: {
    paddingTop: 12,
    gap: 10,
    flexGrow: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize(13),
    textAlign: 'center',
  },
});
