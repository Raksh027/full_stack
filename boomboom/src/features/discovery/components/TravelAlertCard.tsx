import { useTranslation } from 'react-i18next';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize } from '@/theme';

const TRAVEL_ALERT_IMAGE =
  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1400&q=80';

export function TravelAlertCard() {
  const { t } = useTranslation();

  return (
    <ImageBackground
      source={{ uri: TRAVEL_ALERT_IMAGE }}
      style={styles.card}
      imageStyle={styles.image}
    >
      <View style={styles.scrim} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Icon name="airplane-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.title}>{t('home.travelAlert')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('home.travelAlertSubtitle')}</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 168,
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  image: {
    borderRadius: 22,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  copy: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: fontSize(12),
  },
});
