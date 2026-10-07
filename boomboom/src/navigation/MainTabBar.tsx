import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { images } from '@/assets';
import { useGetConversationsInfiniteQuery } from '@/features/chat/api/chatApi';
import { homeAccent } from '@/features/discovery/theme';
import { useGetLikesReceivedInfiniteQuery } from '@/features/matches';
import { Icon, type IconName } from '@/shared/components';
import { flatPageItems } from '@/shared/utils/pagination';
import { colors, palette } from '@/theme';

import type { MainTabParamList } from './types';

const TABS: {
  name: keyof MainTabParamList;
  icon?: IconName;
  logo?: boolean;
}[] = [
  { name: 'Discover', icon: 'home' },
  { name: 'Nearby', icon: 'location-outline' },
  { name: 'Boom', logo: true },
  { name: 'Likes', icon: 'heart-outline' },
  { name: 'Conversations', icon: 'chatbubble-outline' },
];

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { data } = useGetConversationsInfiniteQuery();
  const { data: likesReceived } = useGetLikesReceivedInfiniteQuery();
  const unreadCount = flatPageItems(data).reduce(
    (total, conversation) => total + (conversation.unreadCount ?? 0),
    0,
  );
  const likeCount = flatPageItems(likesReceived).length;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {TABS.map(tab => {
          const route = state.routes.find(item => item.name === tab.name);
          if (!route) {
            return null;
          }
          const focused = state.routes[state.index]?.name === tab.name;

          return (
            <Pressable
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={() => navigation.navigate(tab.name)}
              style={styles.slot}
            >
              {tab.logo ? (
                <View style={[styles.iconWrap, focused && styles.boomActive]}>
                  <Image
                    source={images.logoBottom}
                    style={styles.logo}
                    tintColor={focused ? palette.white : colors.textPrimary}
                  />
                </View>
              ) : (
                <View style={[styles.iconWrap, focused && styles.iconActive]}>
                  <Icon
                    name={tab.icon ?? 'home'}
                    size={20}
                    color={focused ? palette.black : colors.textPrimary}
                  />
                  {tab.name === 'Conversations' && unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                  {tab.name === 'Likes' && likeCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {likeCount > 9 ? '9+' : likeCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '88%',
    height: 64,
    paddingHorizontal: 10,
    borderRadius: 32,
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: palette.gray850,
  },
  slot: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    backgroundColor: homeAccent.yellow,
  },
  boomActive: {
    backgroundColor: homeAccent.purple,
  },
  logo: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: homeAccent.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: palette.black,
    fontSize: 9,
    fontWeight: '800',
  },
});
