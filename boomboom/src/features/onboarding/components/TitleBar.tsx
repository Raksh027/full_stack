import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/shared/components';
import { colors } from '@/theme';

type Props = {
  title: string;
  showBack?: boolean;
};

export function TitleBar({ title, showBack = true }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.side}>{showBack ? <BackButton /> : null}</View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  side: {
    width: 44,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
});
