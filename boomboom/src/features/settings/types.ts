import type {
  BodyType,
  Drinking,
  Gender,
  HeightRange,
  Personality,
  RelationshipGoal,
  WorkCategory,
  WorkoutFrequency,
} from '@/features/profile/types';

export type ThemeMode = 'system' | 'light' | 'dark';

export type DistanceUnit = 'km' | 'mi';

export type AppPreferences = {
  themeMode: ThemeMode;
  language: string | null;
  distanceUnit: DistanceUnit;
  hapticsEnabled: boolean;
  crossPathEnabled: boolean;
  termsAcceptedAt: string | null;
};

export type DiscoveryPreferences = {
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  interestedIn: Gender[];
  isDiscoverable: boolean;
  verifiedOnly: boolean;
  onlineOnly: boolean;
  nationality: string | null;
  relationshipGoals: RelationshipGoal[];
  bodyTypes: BodyType[];
  drinking: Drinking[];
  workout: WorkoutFrequency[];
  personality: Personality[];
  heightRanges: HeightRange[];
  interests: string[];
  languages: string[];
  workCategories: WorkCategory[];
  matchOrientations?: string[];
};

export type NotificationSettings = {
  all: boolean;
  messages: boolean;
  matches: boolean;
  likes: boolean;
  profileViews: boolean;
  crossPath: boolean;
  travellerAlerts: boolean;
  freeTonight: boolean;
  email: boolean;
};
