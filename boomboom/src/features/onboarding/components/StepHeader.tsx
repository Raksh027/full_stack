import { StyleSheet, Text, View } from 'react-native';

import { colors, screen } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  note?: string;
};

export function StepHeader({ title, subtitle, note }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const isCompact = screen.width < 400;

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    gap: 8,
  },
  title: {
    fontSize: isCompact ? 24 : 28,
    lineHeight: isCompact ? 30 : 34,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: isCompact ? 15 : 16,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
