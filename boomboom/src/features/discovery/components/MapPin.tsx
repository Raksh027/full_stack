import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { images } from '@/assets';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { homeAccent } from '../theme';
import type { DiscoveryCandidate } from '../types';

type Props = {
  profile: DiscoveryCandidate;
  left: number;
  top: number;
  selected: boolean;
  onPress: () => void;
};

export function MapPin({ profile, left, top, selected, onPress }: Props) {
  const photo = profile.photos?.[0]?.url;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.wrap,
        { left: `${left * 100}%`, top: `${top * 100}%` },
        selected && styles.wrapSelected,
      ]}
    >
      {selected ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipName} numberOfLines={1}>
            {profile.name}, {profile.age}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.ring,
          selected && styles.ringSelected,
          profile.isOnline && styles.ringOnline,
        ]}
      >
        <Image
          source={photo ? { uri: photo } : images.profilePlaceholder}
          style={styles.avatar}
        />
      </View>
      <View style={[styles.stem, selected && styles.stemSelected]} />
      {profile.isVerified ? (
        <View style={styles.badge}>
          <Icon name="checkmark" size={8} color={palette.black} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 52,
    marginLeft: -26,
    marginTop: -40,
    alignItems: 'center',
    zIndex: 1,
  },
  wrapSelected: {
    zIndex: 5,
    transform: [{ scale: 1.08 }],
  },
  tooltip: {
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: palette.gray750,
    maxWidth: 110,
  },
  tooltipName: {
    color: colors.textPrimary,
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  ring: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: palette.white,
    overflow: 'hidden',
    backgroundColor: palette.gray750,
  },
  ringOnline: {
    borderColor: homeAccent.cyan,
  },
  ringSelected: {
    borderColor: homeAccent.yellow,
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  stem: {
    width: 2,
    height: 8,
    backgroundColor: palette.white,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  stemSelected: {
    backgroundColor: homeAccent.yellow,
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: homeAccent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
