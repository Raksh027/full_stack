import type { SessionUser } from '@/features/auth/types';
import type { MyProfile } from '@/features/profile/types';
import type {
  DiscoveryPreferences,
  NotificationSettings,
} from '@/features/settings/types';
import { getJSON, setJSON } from '@/services/storage/storage';
import { StorageKeys } from '@/services/storage/storageKeys';
import type { ID } from '@/shared/types/api';

export type MockUser = SessionUser & {
  password: string | null;
  emailChangedAt?: string | null;
  pendingEmailChange?: string | null;
};

type MockDatabase = {
  users: Record<ID, MockUser>;
  profiles: Record<ID, MyProfile>;
  discoveryPreferences: Record<ID, DiscoveryPreferences>;
  notificationSettings: Record<ID, NotificationSettings>;
};

let db: MockDatabase = getJSON<MockDatabase>(StorageKeys.mockDatabase) ?? {
  users: {},
  profiles: {},
  discoveryPreferences: {},
  notificationSettings: {},
};

export function readDb(): MockDatabase {
  return db;
}

export function writeDb(mutate: (draft: MockDatabase) => void) {
  const next = JSON.parse(JSON.stringify(db)) as MockDatabase;
  mutate(next);
  db = next;
  setJSON(StorageKeys.mockDatabase, db);
}

/** Recreates a user from a persisted mock token so restarts still authenticate. */
export function ensureUser(userId: ID): MockUser {
  const existing = db.users[userId];
  if (existing) {
    return existing;
  }

  const cached = getJSON<SessionUser>(StorageKeys.sessionUser);
  const fromCache = cached?.id === userId;
  const user: MockUser = {
    id: userId,
    email: fromCache ? cached.email : null,
    provider: fromCache ? cached.provider : 'email',
    password: null,
    isOnboarded: fromCache ? cached.isOnboarded : false,
    isPremium: fromCache ? cached.isPremium : false,
    isEmailVerified: fromCache ? cached.isEmailVerified : true,
  };

  writeDb(draft => {
    draft.users[user.id] = user;
    draft.profiles[user.id] ??= createEmptyProfile(user.id);
  });

  return db.users[userId]!;
}

export function createEmptyProfile(id: ID): MyProfile {
  return {
    id,
    name: '',
    age: 0,
    birthDate: null,
    gender: null,
    sexualOrientation: null,
    showOrientation: true,
    bio: null,
    photos: [],
    interests: [],
    languages: [],
    workCategory: null,
    relationshipGoal: null,
    lifestyle: {
      ethnicity: null,
      bodyType: null,
      heightRange: null,
      eyeColor: null,
      smoking: null,
      drinking: null,
      workout: null,
      personality: null,
    },
    jobTitle: null,
    company: null,
    school: null,
    heightCm: null,
    city: null,
    country: null,
    isVerified: false,
    completeness: 0,
  };
}

export const DEFAULT_DISCOVERY_PREFERENCES: DiscoveryPreferences = {
  minAge: 27,
  maxAge: 42,
  maxDistanceKm: 100,
  interestedIn: ['woman'],
  isDiscoverable: true,
  verifiedOnly: false,
  onlineOnly: false,
  nationality: 'India',
  relationshipGoals: [],
  bodyTypes: [],
  drinking: [],
  workout: [],
  personality: [],
  heightRanges: [],
  interests: [],
  languages: [],
  workCategories: [],
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  all: true,
  messages: true,
  matches: true,
  likes: true,
  profileViews: true,
  crossPath: true,
  travellerAlerts: true,
  freeTonight: true,
  email: true,
};
