import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ConversationsScreen } from '@/features/chat/screens';
import { BoomScreen } from '@/features/discovery/screens/BoomScreen';
import { HomeScreen } from '@/features/discovery/screens/HomeScreen';
import { NearbyScreen } from '@/features/discovery/screens/NearbyScreen';
import { useHomeLocation } from '@/features/discovery/hooks/useHomeLocation';
import { LikesScreen } from '@/features/matches';
import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';

import { MainTabBar } from './MainTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const { data: me } = useGetMyProfileQuery();
  useHomeLocation(me);

  return (
    <Tab.Navigator
      initialRouteName="Discover"
      tabBar={props => <MainTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name="Discover" component={HomeScreen} />
      <Tab.Screen name="Nearby" component={NearbyScreen} />
      <Tab.Screen name="Boom" component={BoomScreen} />
      <Tab.Screen name="Likes" component={LikesScreen} />
      <Tab.Screen name="Conversations" component={ConversationsScreen} />
    </Tab.Navigator>
  );
}
