import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, scale, verticalScale } from '@/theme';

type Props = {
  text: string;
};

export function DividerWithText({ text }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(24),
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inputLightBorder,
  },
  text: {
    paddingHorizontal: scale(12),
    color: colors.placeholder,
    fontSize: fontSize(13),
  },
});
