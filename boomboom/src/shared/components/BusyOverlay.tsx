import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize } from '@/theme';

type Props = {
  visible: boolean;
  message?: string;
};

export function BusyOverlay({ visible, message }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.overlay} pointerEvents="auto">
        <ActivityIndicator size="large" color={colors.textPrimary} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  message: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '600',
    textAlign: 'center',
  },
});
