import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  icon?: IconName;
  onConfirm: () => void;
};

export function PermanentFieldWarning({
  visible,
  title,
  message,
  confirmLabel,
  icon = 'warning-outline',
  onConfirm,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirm}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name={icon} size={28} color="#F5C400" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: palette.gray850,
    borderWidth: 1,
    borderColor: palette.gray750,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245,196,0,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,196,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: palette.black,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});
