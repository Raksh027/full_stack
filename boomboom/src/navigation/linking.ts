import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['boomboom://', 'https://boomboom.app'],
  config: {
    screens: {
      Main: {
        screens: {
          Discover: 'discover',
          Nearby: 'nearby',
          Boom: 'boom',
          Likes: 'likes',
          Conversations: 'messages',
        },
      },
      Chat: 'messages/:conversationId',
      UserProfile: 'u/:userId',
      TravelAlert: 'travel',
      TravelArrivalDetail: 'travel/arrival/:arrivalId',
      FreeTonight: 'free-tonight',
      FreeTonightDetail: 'free-tonight/person/:personId',
      CreateFreeTonight: 'free-tonight/create',
      MyJourneys: 'travel/journeys',
      CreateJourney: 'travel/create',
      Settings: 'settings',
      Notifications: 'notifications',
      DiscoveryPreferences: 'filters',
      BlockedUsers: 'settings/blocked',
      HelpSupport: 'settings/help',
      SendFeedback: 'settings/feedback',
      DeleteAccount: 'settings/delete',
      Paywall: 'premium',
    },
  },
};
