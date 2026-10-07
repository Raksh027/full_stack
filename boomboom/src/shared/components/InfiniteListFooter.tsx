import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type Props = {
  loading?: boolean;
};

export function InfiniteListFooter({ loading = false }: Props) {
  if (!loading) {
    return <View style={styles.spacer} />;
  }
  return (
    <View style={styles.row}>
      <ActivityIndicator color={colors.textPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: {
    height: 24,
  },
  row: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
