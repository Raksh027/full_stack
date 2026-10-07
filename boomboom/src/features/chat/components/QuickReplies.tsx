import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, palette } from '@/theme';

import { chatAccent } from '../theme';

type Props = {
  replies: string[];
  onPick: (value: string) => void;
};

export function QuickReplies({ replies, onPick }: Props) {
  const { t } = useTranslation();

  if (replies.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('chat.quickTitle')}</Text>
      <Text style={styles.hint}>{t('chat.quickHint')}</Text>
      <View style={styles.chips}>
        {replies.map(reply => (
          <Pressable
            key={reply}
            accessibilityRole="button"
            onPress={() => onPick(reply)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.label}>{reply}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    marginTop: 2,
    marginBottom: 14,
    color: colors.textMuted,
    fontSize: fontSize(12),
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: chatAccent.card,
    borderWidth: 1,
    borderColor: palette.gray750,
    maxWidth: '100%',
  },
  chipPressed: {
    borderColor: chatAccent.blue,
    backgroundColor: '#1A2140',
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(12),
    fontWeight: '600',
    lineHeight: 16,
  },
});
