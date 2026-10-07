import { Image, StyleSheet } from 'react-native';

import { images } from '@/assets';
import { screen } from '@/theme';

type Props = {
  size?: number;
};

export function Logo({ size = screen.width * 0.25 }: Props) {
  return (
    <Image
      source={images.logo}
      style={[styles.logo, { width: size, height: size }]}
      accessibilityIgnoresInvertColors
      accessibilityLabel="BoomBoom"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    resizeMode: 'contain',
  },
});
