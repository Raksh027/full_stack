import { Dimensions } from 'react-native';

// Designs were drawn against an iPhone X/11 Pro viewport.
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 375,
  isTablet: SCREEN_WIDTH >= 768,
} as const;

export const scale = (size: number) => (SCREEN_WIDTH / BASE_WIDTH) * size;

export const verticalScale = (size: number) =>
  (SCREEN_HEIGHT / BASE_HEIGHT) * size;

export const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

export function fontSize(size: number) {
  if (screen.isTablet) {
    return size * 1.3;
  }
  if (screen.isSmall) {
    return size * 0.9;
  }
  return moderateScale(size);
}
