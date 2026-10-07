import { useRoute } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/shared/components';
import { colors, fontSize } from '@/theme';

export function PlaceholderScreen() {
  const route = useRoute();

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.body}>
        <Text style={styles.title}>{route.name}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textSecondary,
    fontSize: fontSize(16),
    fontWeight: '600',
  },
});
