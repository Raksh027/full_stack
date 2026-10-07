import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { chatAccent } from '../theme';

export type LikeSentVariant = 'first' | 'limit';

type Props = {
  name: string;
  variant?: LikeSentVariant;
};

const WARNING = '#FFB020';

export function LikeSentBanner({ name, variant = 'first' }: Props) {
  const { t } = useTranslation();
  const isLimit = variant === 'limit';

  return (
    <View style={[styles.banner, isLimit && styles.bannerLimit]}>
      <View style={styles.iconWrap}>
        <View style={[styles.glow, isLimit && styles.glowLimit]} />
        {isLimit ? (
          <View style={styles.iconInfo}>
            <Icon name="information-circle" size={22} color={chatAccent.heart} />
          </View>
        ) : (
          <View style={styles.iconLight}>
            <Icon name="heart" size={18} color={chatAccent.heart} />
            <View style={styles.check}>
              <Icon name="checkmark" size={8} color={palette.white} />
            </View>
          </View>
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>
          {isLimit ? t('chat.likeSentLimit') : t('chat.likeSent')}
        </Text>
        <Text style={styles.body}>
          {isLimit
            ? t('chat.likeSentLimitHint')
            : t('chat.likeSentHint', { name })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 77, 106, 0.65)',
    backgroundColor: '#141414',
  },
  bannerLimit: {
    borderColor: 'rgba(255, 77, 106, 0.75)',
    backgroundColor: '#1A1012',
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 77, 106, 0.18)',
  },
  glowLimit: {
    backgroundColor: 'rgba(255, 77, 106, 0.2)',
  },
  iconLight: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInfo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 77, 106, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 106, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: chatAccent.heart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    lineHeight: 17,
  },
});
