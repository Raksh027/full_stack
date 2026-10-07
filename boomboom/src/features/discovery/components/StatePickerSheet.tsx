import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { fetchJourneyStates } from '../data/geoHierarchy';

type Props = {
  visible: boolean;
  country: string | null;
  selected?: string | null;
  onClose: () => void;
  onSelect: (state: string) => void;
};

export function StatePickerSheet({
  visible,
  country,
  selected,
  onClose,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    if (!country) {
      setStates([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchJourneyStates(country)
      .then(list => {
        if (!cancelled) {
          setStates(list);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible, country]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return states;
    }
    return states.filter(item => item.toLowerCase().includes(q));
  }, [query, states]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={event => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('travel.searchState')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              style={styles.searchInput}
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')}>
                <Icon name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {!country ? (
            <Text style={styles.empty}>{t('travel.selectCountryFirst')}</Text>
          ) : loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#A855F7" />
              <Text style={styles.empty}>{t('travel.loadingLocations')}</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>{t('travel.noStates')}</Text>
              }
              renderItem={({ item }) => {
                const isSelected = selected === item;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onSelect(item);
                      setQuery('');
                      onClose();
                    }}
                    style={[styles.row, isSelected && styles.rowOn]}
                  >
                    <Icon
                      name="map-outline"
                      size={16}
                      color={isSelected ? '#A855F7' : colors.textSecondary}
                    />
                    <Text style={styles.name}>{item}</Text>
                    {isSelected ? (
                      <Icon name="checkmark" size={18} color="#A855F7" />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    height: '58%',
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
    marginBottom: 14,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#111111',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    paddingVertical: 0,
  },
  list: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gray750,
  },
  rowOn: {
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '500',
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize(14),
    paddingTop: 40,
  },
  loading: {
    paddingTop: 24,
    alignItems: 'center',
    gap: 8,
  },
});
