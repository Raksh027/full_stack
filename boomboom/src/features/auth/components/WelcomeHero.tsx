import { Image, StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, palette, screen } from '@/theme';

const PORTRAITS = [
  {
    uri: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=500&q=80',
    rotate: '-11deg',
    left: screen.width * 0.08,
    zIndex: 1,
  },
  {
    uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80',
    rotate: '12deg',
    left: screen.width * 0.46,
    zIndex: 1,
  },
  {
    uri: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=500&q=80',
    rotate: '-2deg',
    left: screen.width * 0.27,
    zIndex: 2,
  },
] as const;

const CARD_W = screen.width * 0.42;
const CARD_H = CARD_W * 1.28;

export function WelcomeHero() {
  return (
    <View style={styles.wrap}>
      {PORTRAITS.map(card => (
        <View
          key={card.uri}
          style={[
            styles.card,
            {
              left: card.left,
              transform: [{ rotate: card.rotate }],
              zIndex: card.zIndex,
            },
          ]}
        >
          <Image source={{ uri: card.uri }} style={styles.photo} />
        </View>
      ))}
      <View style={styles.heart}>
        <Icon name="heart" size={16} color={palette.black} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: CARD_H + 36,
    marginTop: 8,
  },
  card: {
    position: 'absolute',
    top: 10,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: palette.gray750,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  heart: {
    position: 'absolute',
    right: screen.width * 0.18,
    bottom: 4,
    zIndex: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
});
