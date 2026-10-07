import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { chatAccent } from '../theme';

type Props = {
  name: string;
  onLike: () => void;
  onDislike: () => void;
};

export function ChatRequestCard({ name, onLike, onDislike }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.iconRing}>
        <Icon name="chatbubble-ellipses" size={22} color={chatAccent.blue} />
      </View>
      <Text style={styles.title}>{t('chat.requestTitle', { name })}</Text>
      <Text style={styles.body}>{t('chat.requestBody')}</Text>
      <View style={styles.safeRow}>
        <Icon name="shield-checkmark" size={14} color={colors.textSecondary} />
        <Text style={styles.safe}>{t('chat.requestAuto')}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onLike} style={styles.action}>
          <View style={styles.likeCircle}>
            <Icon name="heart" size={22} color={chatAccent.heart} />
          </View>
          <Text style={styles.actionLabel}>{t('chat.like')}</Text>
        </Pressable>
        <Text style={styles.or}>{t('chat.or')}</Text>
        <Pressable accessibilityRole="button" onPress={onDislike} style={styles.action}>
          <View style={styles.noCircle}>
            <Icon name="close" size={22} color={colors.textPrimary} />
          </View>
          <Text style={styles.actionLabel}>{t('chat.dislike')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderRadius: 28,
    backgroundColor: chatAccent.card,
    borderWidth: 1,
    borderColor: palette.gray850,
    alignItems: 'center',
  },
  iconRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1A2140',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    lineHeight: 19,
    textAlign: 'center',
  },
  safeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  safe: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginTop: 18,
  },
  action: {
    alignItems: 'center',
    gap: 6,
  },
  likeCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: palette.gray650,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: palette.gray650,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  or: {
    color: colors.textMuted,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
});
