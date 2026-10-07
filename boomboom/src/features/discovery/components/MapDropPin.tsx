import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme';

type Props = {
  color: string;
  selected?: boolean;
};

/** Solid drop-pin used inside google maps Markers (needs fixed size + collapsable=false). */
export function MapDropPin({ color, selected = false }: Props) {
  const size = selected ? 28 : 24;

  return (
    <View collapsable={false} style={[styles.wrap, { width: size + 8 }]}>
      <View
        collapsable={false}
        style={[
          styles.head,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
      <View
        collapsable={false}
        style={[styles.stem, { backgroundColor: color }]}
      />
      <View
        collapsable={false}
        style={[styles.dot, { backgroundColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    height: 40,
  },
  head: {
    borderWidth: 3,
    borderColor: palette.white,
  },
  stem: {
    width: 3,
    height: 8,
    marginTop: -1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: -2,
    borderWidth: 1.5,
    borderColor: palette.white,
  },
});
