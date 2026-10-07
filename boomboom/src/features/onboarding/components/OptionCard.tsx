import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, palette, screen } from '@/theme';

type Props = {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function OptionCard({
  title,
  description,
  selected,
  onPress,
  disabled,
}: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {selected ? (
          <Icon name="checkmark-circle" size={24} color={colors.textPrimary} />
        ) : null}
      </View>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: screen.width * 0.045,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.gray650,
  },
  selected: {
    backgroundColor: colors.surface,
    borderColor: colors.textPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: screen.width * 0.045,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  description: {
    fontSize: screen.width * 0.036,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
