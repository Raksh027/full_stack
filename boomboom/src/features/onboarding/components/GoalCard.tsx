import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  type ImageSourcePropType,
} from 'react-native';

import { colors } from '@/theme';

type Props = {
  title: string;
  description: string;
  image: ImageSourcePropType;
  width: number;
  selected: boolean;
  onPress: () => void;
};

export function GoalCard({
  title,
  description,
  image,
  width,
  selected,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.card, { width }, selected && styles.selected]}
    >
      <Image source={image} style={[styles.image, { width: width - 20 }]} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#AAA',
  },
  selected: {
    backgroundColor: '#16171B',
    borderColor: colors.textPrimary,
  },
  image: {
    height: 80,
    borderRadius: 10,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
