const { View, Text, Image, ScrollView } = require('react-native');

const layoutAnimation = () => {
  const builder = {};
  for (const method of ['duration', 'delay', 'springify', 'damping', 'stiffness', 'easing']) {
    builder[method] = () => builder;
  }
  return builder;
};

const Animated = { View, Text, Image, ScrollView, createAnimatedComponent: c => c };

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: value => ({ value }),
  useAnimatedStyle: factory => factory(),
  withTiming: value => value,
  withSpring: value => value,
  withRepeat: value => value,
  withSequence: (...values) => values[values.length - 1],
  cancelAnimation: () => {},
  FadeIn: layoutAnimation(),
  FadeOut: layoutAnimation(),
  ZoomIn: layoutAnimation(),
};