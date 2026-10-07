import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type Props = {
  size?: number;
  color?: string;
};

/** Dual opposite-slider mark used for discovery preferences. */
export function PreferenceIcon({
  size = 18,
  color = colors.textPrimary,
}: Props) {
  const thickness = Math.max(2, Math.round(size * 0.14));
  const knob = Math.max(5, Math.round(size * 0.36));
  const barWidth = Math.max(6, Math.round(size * 0.42));
  const rowGap = Math.max(3, Math.round(size * 0.22));

  return (
    <View style={[styles.wrap, { width: size, height: size, gap: rowGap }]}>
      <View style={styles.row}>
        <View
          style={{
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            borderWidth: thickness,
            borderColor: color,
          }}
        />
        <View
          style={{
            width: barWidth,
            height: thickness,
            borderRadius: thickness,
            backgroundColor: color,
          }}
        />
      </View>
      <View style={styles.row}>
        <View
          style={{
            width: barWidth,
            height: thickness,
            borderRadius: thickness,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            borderWidth: thickness,
            borderColor: color,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
