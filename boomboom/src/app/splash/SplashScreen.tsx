import { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import Video from 'react-native-video';

import { videos } from '@/assets';
import { SPLASH_MIN_DURATION_MS } from '@/config/constants';
import { colors } from '@/theme';

type Props = {
  onFinish: () => void;
};

export function SplashScreen({ onFinish }: Props) {
  useEffect(() => {
    const timer = setTimeout(onFinish, SPLASH_MIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <Animated.View exiting={FadeOut.duration(300)} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Video
        source={videos.splash}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        muted
        playInBackground={false}
        disableFocus
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    zIndex: 10,
  },
});
