import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { images } from '@/assets';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { flagUrl } from '../data/journeyLocations';
import { profileFlagUrl } from '@/shared/utils/profileFlag';
import { formatKm } from '@/shared/utils/safeValue';
import {
  tonightActivityMeta,
  type FreeTonightPerson,
} from '../data/mockFreeTonight';

const ACCENT = '#FF2D8A';
const LOCATION_BLUE = '#3AA0FF';

type Props = {
  person: FreeTonightPerson;
  width: number;
  liked: boolean;
  onPress: () => void;
  onToggleLike: () => void;
};

/** "3h left" / "10m left" → "3 h left" / "10 m left" */
function formatTimeLeft(timeLeft: string) {
  const match = timeLeft.match(/(\d+)\s*([hm])(?:ours?|inutes?)?/i);
  if (!match) return timeLeft.trim();
  return `${match[1]} ${match[2].toLowerCase()} left`;
}

export function FreeTonightCard({
  person,
  width,
  liked,
  onPress,
  onToggleLike,
}: Props) {
  const { t } = useTranslation();
  const activity = tonightActivityMeta(person.activity);
  const height = width * 1.42;
  const photo = person.photo?.trim() ? person.photo : null;
  const timing = formatTimeLeft(person.timeLeft);

  return (
    <View style={[styles.shadowWrap, { width, height }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.card, { width, height }]}
      >
        <Image
          source={photo ? { uri: photo } : images.profilePlaceholder}
          style={styles.photo}
        />

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
          locations={[0.35, 0.7, 1]}
          style={styles.fade}
        />

        <View style={styles.topRow}>
          <View style={styles.pill}>
            <Text style={styles.pillEmoji}>{activity.emoji}</Text>
            <Text style={styles.pillText} numberOfLines={1}>
              {t(activity.labelKey)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={onToggleLike}
            style={styles.heart}
          >
            <Icon
              name={liked ? 'heart' : 'heart-outline'}
              size={16}
              color={liked ? ACCENT : palette.white}
            />
          </Pressable>
        </View>

        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {person.name}, {person.age}
            </Text>
            {person.countryFlag || person.flagCode ? (
              <Image
                source={{
                  uri:
                    person.countryFlag ||
                    profileFlagUrl(person) ||
                    flagUrl(person.flagCode),
                }}
                style={styles.flag}
              />
            ) : null}
          </View>
          <View style={styles.infoRow}>
            <View style={styles.statusCol}>
              <View style={styles.status}>
                <View style={styles.leadIcon}>
                  <View style={styles.onlineDot} />
                </View>
                <Text style={styles.statusText}>{t('home.online')}</Text>
              </View>
              <View style={styles.timingRow}>
                <View style={styles.leadIcon}>
                  <Icon
                    name="time-outline"
                    size={12}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.timing}>{timing}</Text>
              </View>
            </View>
            <View style={styles.distance}>
              <Icon name="location" size={11} color={LOCATION_BLUE} />
              <Text style={styles.distanceText}>
                {t('home.distanceKm', {
                  distance: formatKm(person.distanceKm),
                })}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 22,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: palette.gray900,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.62)',
    maxWidth: '72%',
  },
  pillEmoji: {
    fontSize: fontSize(11),
  },
  pillText: {
    color: palette.white,
    fontSize: fontSize(11),
    fontWeight: '700',
    flexShrink: 1,
  },
  heart: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 4,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  flag: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.gray750,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusCol: {
    flexShrink: 1,
    gap: 0,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  leadIcon: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: fontSize(11),
    fontWeight: '600',
    lineHeight: fontSize(14),
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -1,
  },
  timing: {
    color: colors.success,
    fontSize: fontSize(11),
    fontWeight: '600',
    lineHeight: fontSize(13),
  },
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingBottom: 1,
  },
  distanceText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: fontSize(11),
    fontWeight: '700',
  },
});
