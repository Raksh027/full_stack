import { useNavigation } from '@react-navigation/native';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme';

import { Icon } from './Icon';

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ onPress, style }: Props) {
  const navigation = useNavigation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={onPress ?? navigation.goBack}
      style={[styles.button, style]}
    >
      <Icon name="arrow-back" color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 10,
    alignSelf: 'flex-start',
  },
});
