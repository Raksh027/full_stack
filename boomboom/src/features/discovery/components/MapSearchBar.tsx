import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  autocompletePlaces,
  getPlaceLocation,
  PlacesUnavailableError,
  type PlaceLocation,
  type PlaceSuggestion,
} from '@/services/maps/googlePlaces';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { homeAccent } from '../theme';
import { MAP_PEOPLE_HOTSPOTS } from '../utils/mapPins';

type Props = {
  bias?: { latitude: number; longitude: number };
  onPlaceSelected: (place: PlaceLocation) => void;
  onActiveChange?: (active: boolean) => void;
};

export function MapSearchBar({
  bias,
  onPlaceSelected,
  onActiveChange,
}: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [focused, setFocused] = useState(false);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);

  const searching = query.trim().length >= 2;

  useEffect(() => {
    onActiveChange?.(focused || searching);
  }, [focused, onActiveChange, searching]);

  useEffect(() => {
    if (suppressSuggestions) {
      setSuggestions([]);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    const input = query.trim();
    if (input.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      autocompletePlaces(input, bias)
        .then(items => {
          if (!cancelled) {
            setUnavailable(false);
            setSuggestions(items);
          }
        })
        .catch(error => {
          if (!cancelled) {
            setSuggestions([]);
            setUnavailable(error instanceof PlacesUnavailableError);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bias, query, suppressSuggestions]);

  const onChangeQuery = (text: string) => {
    setSuppressSuggestions(false);
    setQuery(text);
  };

  const selectPlace = async (suggestion: PlaceSuggestion) => {
    setResolvingId(suggestion.placeId);
    setSuppressSuggestions(true);
    setSuggestions([]);
    setLoading(false);
    try {
      const place = await getPlaceLocation(suggestion.placeId);
      if (place) {
        setQuery(place.name || suggestion.primaryText);
        setFocused(false);
        inputRef.current?.blur();
        Keyboard.dismiss();
        onPlaceSelected(place);
      } else {
        setSuppressSuggestions(false);
      }
    } catch {
      setSuppressSuggestions(false);
    } finally {
      setResolvingId(null);
    }
  };

  const clear = () => {
    setQuery('');
    setSuggestions([]);
    setSuppressSuggestions(false);
    setFocused(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  const showHotspots = focused && !searching && !suppressSuggestions;
  const showPanel =
    showHotspots ||
    (!suppressSuggestions &&
      searching &&
      (loading || suggestions.length > 0 || (focused && !loading)));

  return (
    <View style={styles.root}>
      <View style={styles.field}>
        <Icon name="search" size={16} color={colors.textSecondary} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('nearby.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.input}
        />
        {loading && !suppressSuggestions ? (
          <ActivityIndicator size="small" color={homeAccent.yellow} />
        ) : query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={clear}
            style={styles.clear}
          >
            <Icon name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {showPanel ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.dropdown}
          contentContainerStyle={styles.dropdownContent}
        >
          {showHotspots ? (
            <View>
              <Text style={styles.hint}>{t('nearby.searchHint')}</Text>
              {MAP_PEOPLE_HOTSPOTS.map((spot, index) => (
                <Pressable
                  key={spot.name}
                  accessibilityRole="button"
                  onPress={() => {
                    setQuery(spot.name);
                    setSuppressSuggestions(true);
                    setFocused(false);
                    inputRef.current?.blur();
                    Keyboard.dismiss();
                    onPlaceSelected({
                      placeId: `hotspot:${spot.name}`,
                      name: spot.name,
                      address: 'Delhi, India',
                      latitude: spot.latitude,
                      longitude: spot.longitude,
                    });
                  }}
                  style={[
                    styles.row,
                    index < MAP_PEOPLE_HOTSPOTS.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View style={styles.pin}>
                    <Icon
                      name="location-outline"
                      size={16}
                      color={homeAccent.yellow}
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.primary} numberOfLines={1}>
                      {spot.name}
                    </Text>
                    <Text style={styles.secondary} numberOfLines={1}>
                      Delhi
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : suggestions.length > 0
            ? suggestions.map((item, index) => (
                <Pressable
                  key={item.placeId}
                  accessibilityRole="button"
                  onPress={() => selectPlace(item)}
                  style={[
                    styles.row,
                    index < suggestions.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View style={styles.pin}>
                    <Icon
                      name="location-outline"
                      size={16}
                      color={homeAccent.yellow}
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.primary} numberOfLines={1}>
                      {item.primaryText}
                    </Text>
                    {item.secondaryText ? (
                      <Text style={styles.secondary} numberOfLines={1}>
                        {item.secondaryText}
                      </Text>
                    ) : null}
                  </View>
                  {resolvingId === item.placeId ? (
                    <ActivityIndicator size="small" color={homeAccent.cyan} />
                  ) : null}
                </Pressable>
              ))
            : !loading ? (
                <Text style={styles.empty}>
                  {t(
                    unavailable
                      ? 'nearby.searchUnavailable'
                      : 'nearby.searchEmpty',
                  )}
                </Text>
              ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    zIndex: 30,
    elevation: 30,
    overflow: 'visible',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    backgroundColor: 'rgba(12,12,12,0.92)',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    paddingVertical: 0,
  },
  clear: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    maxHeight: 260,
    borderRadius: 16,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: palette.gray750,
    zIndex: 40,
    elevation: 40,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  dropdownContent: {
    paddingVertical: 4,
  },
  hint: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    color: colors.textMuted,
    fontSize: fontSize(12),
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gray750,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1600',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  primary: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  secondary: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize(12),
  },
  empty: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
});
