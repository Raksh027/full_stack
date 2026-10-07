import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import type { TravelCountrySummary } from '../data/mockTravelArrivals';

type Props = {
  country: TravelCountrySummary;
  selected?: boolean;
  onPress: () => void;
};

function flagImageUrl(code: string) {
  return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
}

export function TravelCountryCard({ country, selected, onPress }: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: selected ? `${country.accent}18` : '#0F0F0F',
        },
      ]}
    >
      <View style={styles.flagBlock}>
        <View style={styles.flagCircle}>
          {country.flagUrl || country.flagCode ? (
            <Image
              source={{
                uri: country.flagUrl || flagImageUrl(country.flagCode),
              }}
              style={styles.flagImage}
              resizeMode="cover"
            />
          ) : null}
        </View>
        {country.extra > 0 ? (
          <View style={styles.extra}>
            <Text style={styles.extraText}>+{country.extra}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.country}>{country.country}</Text>
        <Text style={styles.count}>{country.arriving}</Text>
        <Text style={styles.arriving}>{t('travel.arrivingCount')}</Text>
      </View>

      <View style={styles.cityPill}>
        <Icon name="location" size={11} color={palette.white} />
        <Text style={styles.city} numberOfLines={1}>
          {country.city}
        </Text>
      </View>
    </Pressable>
  );
}

const FLAG_SIZE = 38;

const styles = StyleSheet.create({
  card: {
    width: 110,
    height: 168,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: palette.gray500,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flagBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagCircle: {
    width: FLAG_SIZE,
    height: FLAG_SIZE,
    borderRadius: FLAG_SIZE / 2,
    borderWidth: 1.5,
    borderColor: palette.gray500,
    overflow: 'hidden',
    backgroundColor: palette.gray850,
  },
  flagImage: {
    width: '100%',
    height: '100%',
  },
  extra: {
    position: 'absolute',
    right: -16,
    bottom: -2,
    minWidth: 24,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0F0F0F',
  },
  extraText: {
    color: colors.textPrimary,
    fontSize: fontSize(10),
    fontWeight: '800',
  },
  body: {
    alignItems: 'center',
  },
  country: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '700',
    textAlign: 'center',
  },
  count: {
    marginTop: 1,
    color: colors.textPrimary,
    fontSize: fontSize(28),
    fontWeight: '800',
    lineHeight: 32,
    textAlign: 'center',
  },
  arriving: {
    color: colors.textSecondary,
    fontSize: fontSize(11),
    fontWeight: '500',
    textAlign: 'center',
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: palette.gray650,
  },
  city: {
    color: palette.white,
    fontSize: fontSize(10),
    fontWeight: '700',
  },
});
