export const TAG_TYPES = [
  'Session',
  'MyProfile',
  'Profile',
  'Feed',
  'Map',
  'Matches',
  'Likes',
  'Conversations',
  'Messages',
  'DiscoveryPreferences',
  'NotificationSettings',
  'Subscription',
  'Blocks',
  'Notifications',
  'Travel',
  'Tonight',
] as const;

export type TagType = (typeof TAG_TYPES)[number];
