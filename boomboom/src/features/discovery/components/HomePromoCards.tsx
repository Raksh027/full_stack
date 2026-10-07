import { useTranslation } from 'react-i18next';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { images } from '@/assets';
import { Icon } from '@/shared/components';
import { fontSize, palette, screen } from '@/theme';

import { homeAccent } from '../theme';

type Props = {
  onPressTravel: () => void;
  onPressFreelance: () => void;
};

const GAP = 8;
const PAD = 10;
const CARD_WIDTH = (screen.width - PAD * 2 - GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.48;

export function HomePromoCards({ onPressTravel, onPressFreelance }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onPressTravel}
        style={styles.card}
      >
        <ImageBackground
          source={images.travelAlert}
          style={styles.image}
          imageStyle={styles.imageRadius}
          resizeMode="cover"
        >
          <View style={styles.bar}>
            <View style={styles.titleRow}>
              <View style={styles.copy}>
                <View style={styles.line}>
                  <Icon name="airplane" size={16} color={palette.white} />
                  <Text style={styles.title}>{t('home.travel')}</Text>
                </View>
                <Text style={styles.title}>{t('home.alert')}</Text>
                <Text style={styles.hint}>{t('home.travelAlertHint')}</Text>
              </View>
              <View style={styles.chevron}>
                <Icon name="chevron-forward" size={14} color={palette.white} />
              </View>
            </View>
          </View>
        </ImageBackground>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onPressFreelance}
        style={styles.card}
      >
        <ImageBackground
          source={images.freelanceTonight}
          style={styles.image}
          imageStyle={styles.imageRadius}
          resizeMode="contain"
        >
          <View style={styles.bar}>
            <View style={styles.titleRow}>
              <View style={styles.copy}>
                <Text style={styles.title}>{t('home.free')}</Text>
                <Text style={styles.accent}>{t('home.tonight')}</Text>
                <Text style={styles.hint}>{t('home.freeTonightHint')}</Text>
              </View>
              <View style={styles.chevron}>
                <Icon name="chevron-forward" size={14} color={palette.white} />
              </View>
            </View>
          </View>
        </ImageBackground>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: PAD,
    gap: GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: palette.black,
    borderWidth: 0.5,
    borderColor: palette.white,
  },
  image: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    justifyContent: 'flex-end',
  },
  imageRadius: {
    borderRadius: 26,
  },
  bar: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copy: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    color: palette.white,
    fontSize: fontSize(18),
    fontWeight: '700',
    lineHeight: 22,
  },
  accent: {
    color: homeAccent.yellow,
    fontSize: fontSize(18),
    fontWeight: '700',
    lineHeight: 22,
  },
  hint: {
    marginTop: 4,
    color: palette.white,
    fontSize: fontSize(11),
    fontWeight: '400',
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
