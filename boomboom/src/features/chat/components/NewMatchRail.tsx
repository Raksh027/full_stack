import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { images } from '@/assets';
import { homeAccent } from '@/features/discovery/theme';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import type { Conversation } from '../types';

type Props = {
  matches: Conversation[];
  onPress: (conversation: Conversation) => void;
};

export function NewMatchRail({ matches, onPress }: Props) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {matches.map(conversation => {
        const photo = conversation.user.photos?.[0]?.url;
        return (
          <Pressable
            key={conversation.id}
            accessibilityRole="button"
            onPress={() => onPress(conversation)}
            style={styles.item}
          >
            <View style={styles.ring}>
              <Image
                source={photo ? { uri: photo } : images.profilePlaceholder}
                style={styles.avatar}
              />
              <View style={styles.heart}>
                <Icon name="heart" size={10} color={palette.black} />
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {conversation.user.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 14,
  },
  item: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: homeAccent.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.gray750,
  },
  heart: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: homeAccent.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize(12),
    fontWeight: '600',
    maxWidth: 72,
    textAlign: 'center',
  },
});
