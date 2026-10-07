import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { images } from '@/assets';
import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import type { MapCardKind } from '../utils/mapCardKind';

export type MapPeopleFilter = 'all' | MapCardKind;

type Props = {
  active: MapPeopleFilter;
  onChange: (filter: MapPeopleFilter) => void;
};

const FILTERS: {
  key: MapPeopleFilter;
  icon?: IconName;
}[] = [
  { key: 'all' },
  { key: 'crossedPaths' },
  { key: 'freeTonight', icon: 'moon' },
  { key: 'nearby', icon: 'navigate' },
];

export function MapPeopleTabs({ active, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {FILTERS.map(filter => {
        const selected = active === filter.key;
        const tint = selected ? palette.white : colors.textPrimary;
        const label =
          filter.key === 'all'
            ? t('nearby.filterAll')
            : filter.key === 'nearby'
              ? t('nearby.filterNearby')
              : filter.key === 'crossedPaths'
                ? t('nearby.filterCrossPath')
                : t('nearby.freeTonight');

        return (
          <Pressable
            key={filter.key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(filter.key)}
            style={[styles.btn, selected && styles.btnOn]}
          >
            {filter.key === 'all' ? (
              <Text style={[styles.allLabel, selected && styles.allLabelOn]}>
                {t('nearby.filterAll')}
              </Text>
            ) : filter.key === 'crossedPaths' ? (
              <Image
                source={images.crossPath}
                style={styles.crossPathIcon}
                resizeMode="contain"
              />
            ) : (
              <Icon name={filter.icon!} size={18} color={tint} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  btnOn: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  allLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(12),
    fontWeight: '800',
  },
  allLabelOn: {
    color: palette.white,
  },
  crossPathIcon: {
    width: 24,
    height: 24,
    tintColor: palette.white,
  },
});
