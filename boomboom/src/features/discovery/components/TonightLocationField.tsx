import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
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
import { colors, fontSize } from '@/theme';

const PURPLE = '#B56CFF';
const FIELD_BG = '#14101F';
const BORDER = 'rgba(181,108,255,0.45)';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onPlaceSelected?: (place: PlaceLocation) => void;
  locating?: boolean;
  onPressLocate: () => void;
  bias?: { latitude: number; longitude: number };
};

export function venueFromPlace(place: PlaceLocation) {
  const name = place.name.trim();
  const address = place.address.trim();
  if (address && name && address.toLowerCase().includes(name.toLowerCase())) {
    return address.slice(0, 160);
  }
  return [name, address].filter(Boolean).join(', ').slice(0, 160);
}

export function TonightLocationField({
  value,
  onChangeText,
  onPlaceSelected,
  locating = false,
  onPressLocate,
  bias,
}: Props) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dirty, setDirty] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.trim();
  const searching =
    dirty && query.length >= 2 && (focused || resolvingId !== null);

  useEffect(() => {
    if (!searching) {
      setSuggestions([]);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      autocompletePlaces(query, bias)
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
  }, [bias, query, searching]);

  useEffect(
    () => () => {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current);
      }
    },
    [],
  );

  const selectPlace = async (suggestion: PlaceSuggestion) => {
    setResolvingId(suggestion.placeId);
    setSuggestions([]);
    setLoading(false);
    try {
      const place = await getPlaceLocation(suggestion.placeId);
      if (place) {
        onChangeText(venueFromPlace(place) || suggestion.primaryText);
        onPlaceSelected?.(place);
        setDirty(false);
        setFocused(false);
        Keyboard.dismiss();
      }
    } finally {
      setResolvingId(null);
    }
  };

  const showPanel =
    searching && (loading || suggestions.length > 0 || (focused && !loading));

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <View style={styles.iconTile}>
          <Icon name="location" size={18} color={PURPLE} />
        </View>
        <TextInput
          value={value}
          onChangeText={text => {
            setDirty(true);
            onChangeText(text);
          }}
          onFocus={() => {
            if (blurTimer.current) {
              clearTimeout(blurTimer.current);
              blurTimer.current = null;
            }
            setFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => {
              setFocused(false);
            }, 180);
          }}
          placeholder={t('createTonight.locationPlaceholder')}
          placeholderTextColor="#7A7388"
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          style={styles.locationInput}
        />
        {loading && searching ? (
          <ActivityIndicator size="small" color={PURPLE} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('createTonight.useLocation')}
          onPress={() => {
            setDirty(false);
            setSuggestions([]);
            Keyboard.dismiss();
            onPressLocate();
          }}
          disabled={locating}
          style={styles.locateBtn}
        >
          {locating ? (
            <ActivityIndicator size="small" color={PURPLE} />
          ) : (
            <Icon name="locate" size={18} color={PURPLE} />
          )}
        </Pressable>
      </View>

      {showPanel ? (
        <View style={styles.dropdown}>
          {suggestions.length > 0
            ? suggestions.map((item, index) => (
                <Pressable
                  key={item.placeId}
                  accessibilityRole="button"
                  onPress={() => {
                    void selectPlace(item);
                  }}
                  style={[
                    styles.row,
                    index < suggestions.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View style={styles.pin}>
                    <Icon name="location-outline" size={16} color={PURPLE} />
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
                    <ActivityIndicator size="small" color={PURPLE} />
                  ) : null}
                </Pressable>
              ))
            : !loading ? (
                <Text style={styles.empty}>
                  {t(
                    unavailable
                      ? 'createTonight.locationSearchUnavailable'
                      : 'createTonight.locationSearchEmpty',
                  )}
                </Text>
              ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 20,
    elevation: 20,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(181,108,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(181,108,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '600',
    paddingVertical: 0,
  },
  locateBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(181,108,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(181,108,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#1A1428',
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
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
    borderBottomColor: 'rgba(181,108,255,0.22)',
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(181,108,255,0.12)',
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
    color: '#8E879B',
    fontSize: fontSize(13),
  },
});
