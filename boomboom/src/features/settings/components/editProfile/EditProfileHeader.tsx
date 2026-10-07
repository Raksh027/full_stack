import { Pressable, StyleSheet, Text, View } from 'react-native';

import { homeAccent } from '@/features/discovery/theme';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

type Props = {
  title: string;
  saveLabel: string;
  saving: boolean;
  canSave: boolean;
  onBack: () => void;
  onSave: () => void;
};

export function EditProfileHeader({
  title,
  saveLabel,
  saving,
  canSave,
  onBack,
  onSave,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
      >
        <Icon name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.titleRow}>
        <Icon name="create-outline" size={18} color={homeAccent.yellow} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onSave}
        disabled={!canSave || saving}
        style={({ pressed }) => [
          styles.saveBtn,
          (!canSave || saving) && styles.saveDisabled,
          pressed && canSave && !saving && styles.pressed,
        ]}
      >
        <Text style={styles.saveText}>{saveLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: palette.gray850,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.gray900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: homeAccent.yellow,
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveText: {
    color: palette.black,
    fontSize: fontSize(14),
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
