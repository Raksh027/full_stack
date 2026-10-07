import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, verticalScale } from '@/theme';

type Props = {
  prompt: string;
  action: string;
  onPress: () => void;
};

export function AuthFooterLink({ prompt, action, onPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.prompt}>{prompt}</Text>
      <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
        <Text style={styles.action}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(24),
  },
  prompt: {
    color: colors.placeholder,
    fontSize: fontSize(14),
  },
  action: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
});
