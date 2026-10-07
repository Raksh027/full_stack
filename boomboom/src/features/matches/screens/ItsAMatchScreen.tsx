import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';

import { images } from '@/assets';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

type Props = RootStackScreenProps<'ItsAMatch'>;

export function ItsAMatchScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { conversationId, name, photo } = route.params;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(139,92,255,0.45)', 'rgba(0,0,0,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.kicker}>{t('notifications.match')}</Text>
      <View style={styles.avatarRing}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <Image source={images.profilePlaceholder} style={styles.avatar} />
        )}
      </View>
      <Text style={styles.title}>
        {name
          ? t('notifications.matchBody', { name })
          : t('notifications.match')}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.replace('Chat', { conversationId, requestAccepted: true })
        }
        style={styles.primary}
      >
        <Text style={styles.primaryLabel}>{t('chat.sayHi')}</Text>
        <Icon name="chatbubble" size={16} color={palette.black} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={styles.secondary}
      >
        <Text style={styles.secondaryLabel}>{t('common.continue')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  kicker: {
    color: palette.white,
    fontSize: fontSize(28),
    fontWeight: '800',
    textAlign: 'center',
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#F5C400',
    marginVertical: 8,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: colors.textSecondary,
    fontSize: fontSize(15),
    textAlign: 'center',
    marginBottom: 12,
  },
  primary: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: {
    color: palette.black,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  secondary: {
    paddingVertical: 12,
  },
  secondaryLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
});
