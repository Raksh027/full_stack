import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Icon } from '@/shared/components';
import { colors } from '@/theme';

export type MediaMode = 'photo' | 'video';

type Props = {
  mode: MediaMode;
  photoCount: number;
  onChange: (mode: MediaMode) => void;
};

const TRACK = ['#6BA6FF', '#F4C4F8'] as const;

export function MediaToggle({ mode, photoCount, onChange }: Props) {
  return (
    <LinearGradient
      colors={[...TRACK]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.track}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add photo"
        onPress={() => onChange('photo')}
        style={({ pressed }) => [
          styles.segment,
          mode === 'photo' && styles.segmentActive,
          pressed && styles.pressed,
        ]}
      >
        <Icon name="camera-outline" size={15} color={colors.textInverse} />
        {photoCount > 0 ? <Text style={styles.count}>{photoCount}</Text> : null}
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add video"
        onPress={() => onChange('video')}
        style={({ pressed }) => [
          styles.segment,
          mode === 'video' && styles.segmentActive,
          pressed && styles.pressed,
        ]}
      >
        <Icon name="videocam-outline" size={16} color={colors.textInverse} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 4,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    gap: 3,
  },
  segmentActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  pressed: {
    opacity: 0.7,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  count: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
  },
});
