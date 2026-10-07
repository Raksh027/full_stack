import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { images } from '@/assets';
import { selectHasAcceptedTerms } from '@/features/settings/store/preferencesSlice';
import type { AuthStackScreenProps } from '@/navigation/types';
import { Icon } from '@/shared/components';
import { useAppSelector } from '@/store/hooks';
import { colors, fontSize, palette } from '@/theme';

export function WelcomeScreen({ navigation }: AuthStackScreenProps<'Welcome'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hasAcceptedTerms = useAppSelector(selectHasAcceptedTerms);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(false, 'fade');
    }, []),
  );

  const handleGetStarted = () => {
    navigation.navigate(hasAcceptedTerms ? 'EmailSignIn' : 'Terms');
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden={false} barStyle="light-content" />
      <View style={{ height: insets.top }} />

      <View style={styles.media}>
        <Image
          source={images.welcome}
          resizeMode="contain"
          style={styles.poster}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            'transparent',
            'rgba(0,0,0,0.4)',
            'rgba(0,0,0,0.88)',
            '#000000',
          ]}
          locations={[0.3, 0.55, 0.8, 1]}
          style={styles.bottomFade}
        />
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('welcome.getStarted')}
          onPress={handleGetStarted}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonText}>{t('welcome.getStarted')}</Text>
          <Icon name="arrow-forward" size={18} color={palette.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.black,
  },
  media: {
    flex: 1,
    backgroundColor: colors.background,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  bottomFade: {
    ...StyleSheet.absoluteFillObject,
  },
  footer: {
    backgroundColor: palette.black,
    paddingTop: 8,
    paddingHorizontal: 22,
  },
  button: {
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F5C400',
    transform: [{ translateY: -30 }],
  },
  pressed: {
    opacity: 0.86,
  },
  buttonText: {
    color: palette.black,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
});
