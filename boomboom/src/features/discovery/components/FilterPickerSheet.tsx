import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon, InfiniteListFooter } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

export type FilterPickerOption = {
  id: string;
  label: string;
  flagUrl?: string;
};

type Props = {
  visible: boolean;
  title: string;
  searchPlaceholder?: string;
  options: FilterPickerOption[];
  selected?: string | null;
  remoteSearch?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onSearchChange?: (query: string) => void;
  onEndReached?: () => void;
};

export function FilterPickerSheet({
  visible,
  title,
  searchPlaceholder,
  options,
  selected,
  remoteSearch = false,
  loading = false,
  loadingMore = false,
  onClose,
  onSelect,
  onSearchChange,
  onEndReached,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (remoteSearch) {
      return options;
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(item => item.label.toLowerCase().includes(q));
  }, [options, query, remoteSearch]);

  const showSearch = remoteSearch || Boolean(searchPlaceholder) || options.length > 6;

  const closeSheet = () => {
    setQuery('');
    onSearchChange?.('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeSheet}
    >
      <Pressable style={styles.scrim} onPress={closeSheet}>
        <Pressable
          style={styles.sheet}
          onPress={event => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {showSearch ? (
            <View style={styles.search}>
              <Icon name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={text => {
                  setQuery(text);
                  onSearchChange?.(text);
                }}
                placeholder={searchPlaceholder ?? t('common.search')}
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                style={styles.searchInput}
              />
              {loading && remoteSearch ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : null}
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              remoteSearch ? (
                <InfiniteListFooter loading={loadingMore} />
              ) : null
            }
            ListEmptyComponent={
              loading && remoteSearch ? (
                <View style={styles.emptyWrap}>
                  <ActivityIndicator color={palette.white} />
                </View>
              ) : (
                <Text style={styles.empty}>{t('travel.noFilterOptions')}</Text>
              )
            }
            renderItem={({ item }) => {
              const isSelected = selected === item.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelect(item.id);
                    setQuery('');
                    onSearchChange?.('');
                    onClose();
                  }}
                  style={[styles.row, isSelected && styles.rowOn]}
                >
                  {item.flagUrl ? (
                    <Image
                      source={{ uri: item.flagUrl }}
                      style={styles.flag}
                      resizeMode="cover"
                    />
                  ) : null}
                  <Text style={styles.name}>{item.label}</Text>
                  {isSelected ? (
                    <Icon name="checkmark" size={18} color="#A855F7" />
                  ) : null}
                </Pressable>
              );
            }}
          />
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
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
    marginBottom: 10,
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
  flag: {
    width: 28,
    height: 20,
    borderRadius: 3,
    backgroundColor: palette.gray750,
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
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 40,
  },
});
