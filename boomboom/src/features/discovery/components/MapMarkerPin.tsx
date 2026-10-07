import { Image, StyleSheet, View } from 'react-native';

import { images } from '@/assets';
import { palette } from '@/theme';

import { homeAccent } from '../theme';
import type { DiscoveryCandidate } from '../types';

type Props = {
  profile: DiscoveryCandidate;
  selected: boolean;
  onImageLoad?: () => void;
};

const PHOTO = 34;

export function MapMarkerPin({ profile, selected, onImageLoad }: Props) {
  const photo = profile.photos?.[0]?.url;
  const ring = selected
    ? homeAccent.yellow
    : profile.isOnline
      ? homeAccent.cyan
      : palette.white;

  return (
    <View collapsable={false} style={styles.wrap}>
      <View style={[styles.head, { borderColor: ring }]}>
        <Image
          source={photo ? { uri: photo } : images.profilePlaceholder}
          style={styles.photo}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={onImageLoad}
        />
      </View>
      <View style={[styles.tip, { borderTopColor: ring }]} />
      {profile.isOnline ? <View style={styles.live} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 46,
    alignItems: 'center',
  },
  head: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: palette.gray750,
  },
  photo: {
    width: PHOTO - 4,
    height: PHOTO - 4,
  },
  tip: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  live: {
    position: 'absolute',
    top: 1,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.green,
    borderWidth: 1.5,
    borderColor: '#0B1014',
  },
});
