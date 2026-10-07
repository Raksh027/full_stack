import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 24, color = colors.textPrimary }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}
