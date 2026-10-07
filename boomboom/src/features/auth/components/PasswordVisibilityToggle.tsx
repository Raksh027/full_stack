import { Pressable } from 'react-native';

import { Icon } from '@/shared/components';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  onToggle: () => void;
};

export function PasswordVisibilityToggle({ visible, onToggle }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      hitSlop={8}
      onPress={onToggle}
    >
      <Icon
        name={visible ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        color={colors.textMuted}
      />
    </Pressable>
  );
}
