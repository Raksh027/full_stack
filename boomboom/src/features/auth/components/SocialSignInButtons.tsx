import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { images } from '@/assets';
import { Icon } from '@/shared/components';
import { palette } from '@/theme';

import { useSocialSignIn } from '../hooks/useSocialSignIn';
import { isAppleSignInAvailable } from '../services/appleAuth';
import { isFacebookSignInConfigured } from '../services/facebookAuth';

type Props = {
  disabled?: boolean;
};

export function SocialSignInButtons({ disabled = false }: Props) {
  const { t } = useTranslation();
  const { signIn, pendingProvider } = useSocialSignIn();
  const isBusy = disabled || pendingProvider !== null;

  const facebook = () => {
    if (!isFacebookSignInConfigured()) {
      Alert.alert(t('auth.facebook'), t('auth.facebookNotConfigured'));
      return;
    }
    signIn('facebook');
  };

  const apple = () => {
    if (!isAppleSignInAvailable()) {
      Alert.alert(t('auth.apple'), t('auth.appleUnavailable'));
      return;
    }
    signIn('apple');
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.facebook')}
        onPress={facebook}
        disabled={isBusy}
        style={({ pressed }) => [
          styles.circle,
          styles.facebook,
          (isBusy || pressed) && styles.dimmed,
        ]}
      >
        {pendingProvider === 'facebook' ? (
          <ActivityIndicator color={palette.white} />
        ) : (
          <Icon name="logo-facebook" size={28} color={palette.white} />
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.google')}
        onPress={() => signIn('google')}
        disabled={isBusy}
        style={({ pressed }) => [
          styles.circle,
          styles.light,
          (isBusy || pressed) && styles.dimmed,
        ]}
      >
        {pendingProvider === 'google' ? (
          <ActivityIndicator color={palette.black} />
        ) : (
          <Image source={images.google} style={styles.google} />
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.apple')}
        onPress={apple}
        disabled={isBusy}
        style={({ pressed }) => [
          styles.circle,
          styles.light,
          (isBusy || pressed) && styles.dimmed,
        ]}
      >
        {pendingProvider === 'apple' ? (
          <ActivityIndicator color={palette.black} />
        ) : (
          <Icon name="logo-apple" size={26} color={palette.black} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
  },
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facebook: {
    backgroundColor: '#1877F2',
  },
  light: {
    backgroundColor: palette.white,
  },
  google: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  dimmed: {
    opacity: 0.7,
  },
});
