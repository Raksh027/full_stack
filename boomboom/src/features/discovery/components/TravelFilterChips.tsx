import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

type FilterKey =
  | 'arriving'
  | 'nationality'
  | 'purpose'
  | 'style'
  | 'gender'
  | 'viewAll';

type Props = {
  active?: FilterKey | null;
  nationalityLabel?: string | null;
  lookingForLabel?: string | null;
  arrivingLabel?: string | null;
  travelStyleLabel?: string | null;
  genderLabel?: string | null;
  onPress: (key: FilterKey) => void;
};

const FILTERS: {
  key: FilterKey;
  icon: IconName;
  labelKey:
    | 'travel.filterArriving'
    | 'travel.filterNationality'
    | 'travel.filterLookingFor'
    | 'travel.filterTravelStyle'
    | 'travel.filterGender'
    | 'travel.viewAll';
  chevron: IconName;
}[] = [
  {
    key: 'arriving',
    icon: 'time-outline',
    labelKey: 'travel.filterArriving',
    chevron: 'chevron-down',
  },
  {
    key: 'nationality',
    icon: 'globe-outline',
    labelKey: 'travel.filterNationality',
    chevron: 'chevron-down',
  },
  {
    key: 'purpose',
    icon: 'airplane-outline',
    labelKey: 'travel.filterLookingFor',
    chevron: 'chevron-down',
  },
  {
    key: 'style',
    icon: 'walk-outline',
    labelKey: 'travel.filterTravelStyle',
    chevron: 'chevron-down',
  },
  {
    key: 'gender',
    icon: 'male-female',
    labelKey: 'travel.filterGender',
    chevron: 'chevron-down',
  },
  {
    key: 'viewAll',
    icon: 'earth-outline',
    labelKey: 'travel.viewAll',
    chevron: 'chevron-forward',
  },
];

export function TravelFilterChips({
  active,
  nationalityLabel,
  lookingForLabel,
  arrivingLabel,
  travelStyleLabel,
  genderLabel,
  onPress,
}: Props) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FILTERS.map(filter => {
        const selected =
          (filter.key === 'arriving' && Boolean(arrivingLabel)) ||
          (filter.key === 'nationality' && Boolean(nationalityLabel)) ||
          (filter.key === 'purpose' && Boolean(lookingForLabel)) ||
          (filter.key === 'style' && Boolean(travelStyleLabel)) ||
          (filter.key === 'gender' && Boolean(genderLabel)) ||
          (filter.key === 'viewAll' && active === 'viewAll');
        const label =
          filter.key === 'nationality' && nationalityLabel
            ? nationalityLabel
            : filter.key === 'purpose' && lookingForLabel
              ? lookingForLabel
              : filter.key === 'arriving' && arrivingLabel
                ? arrivingLabel
                : filter.key === 'style' && travelStyleLabel
                  ? travelStyleLabel
                  : filter.key === 'gender' && genderLabel
                    ? genderLabel
                    : t(filter.labelKey);
        return (
          <Pressable
            key={filter.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onPress(filter.key)}
            style={[styles.chip, selected && styles.chipOn]}
          >
            <Icon
              name={filter.icon}
              size={13}
              color={selected ? palette.black : colors.textPrimary}
            />
            <Text style={[styles.label, selected && styles.labelOn]}>
              {label}
            </Text>
            <Icon
              name={filter.chevron}
              size={13}
              color={selected ? palette.black : 'rgba(255,255,255,0.55)'}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },
  chipOn: {
    backgroundColor: palette.white,
    borderColor: palette.white,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  labelOn: {
    color: palette.black,
  },
});
