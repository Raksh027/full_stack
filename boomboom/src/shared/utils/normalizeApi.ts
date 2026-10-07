import type { ChatMessage, Conversation } from '@/features/chat/types';
import type { FreeTonightPerson } from '@/features/discovery/data/mockFreeTonight';
import {
  normalizeTonightActivity,
} from '@/features/discovery/data/mockFreeTonight';
import type { MyJourney } from '@/features/discovery/data/mockMyJourneys';
import type {
  TravelArrival,
  TravelCountrySummary,
  TravelInterestTag,
  TravelTripType,
} from '@/features/discovery/data/mockTravelArrivals';
import { TRAVEL_TRIP_META } from '@/features/discovery/data/mockTravelArrivals';
import type { DiscoveryCandidate } from '@/features/discovery/types';
import type {
  LikeProfile,
  LikeReceived,
  LikeSent,
  Match,
  ProfileView,
} from '@/features/matches/types';
import type { InboxNotification } from '@/features/notifications/api/notificationsApi';
import type { Lifestyle, MyProfile, Profile } from '@/features/profile/types';
import type { BlockedUser } from '@/features/safety/api/safetyApi';
import type {
  DiscoveryPreferences,
  NotificationSettings,
} from '@/features/settings/types';
import type { Subscription } from '@/features/subscription/api/subscriptionApi';
import { env } from '@/config/env';
import type { CursorPage, Photo } from '@/shared/types/api';

import {
  asArray,
  asBoolean,
  asId,
  asNullableNumber,
  asNullableString,
  asNumber,
  asRecord,
  asString,
  asStringArray,
  isRecord,
  primaryPhotoUrl,
} from './safeValue';

export { asRecord } from './safeValue';

const EMPTY_LIFESTYLE: Lifestyle = {
  ethnicity: null,
  bodyType: null,
  heightRange: null,
  eyeColor: null,
  smoking: null,
  drinking: null,
  workout: null,
  personality: null,
};

export const EMPTY_DISCOVERY_PREFERENCES: DiscoveryPreferences = {
  minAge: 18,
  maxAge: 99,
  maxDistanceKm: 50,
  interestedIn: [],
  isDiscoverable: true,
  verifiedOnly: false,
  onlineOnly: false,
  nationality: null,
  relationshipGoals: [],
  bodyTypes: [],
  drinking: [],
  workout: [],
  personality: [],
  heightRanges: [],
  interests: [],
  languages: [],
  workCategories: [],
  matchOrientations: [],
};

export const EMPTY_NOTIFICATION_SETTINGS: NotificationSettings = {
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

const TRIP_ALIASES: Record<string, TravelTripType> = {
  business: 'business',
  vacation: 'vacation',
  nightlife: 'nightlife',
  solo: 'solo',
  companion: 'companion',
  tourguide: 'tourGuide',
  tour_guide: 'tourGuide',
  massagespa: 'massageSpa',
  massage_spa: 'massageSpa',
  spa: 'massageSpa',
};

export function normalizeTripType(value: unknown): TravelTripType {
  const raw = asString(value).trim();
  if (raw in TRAVEL_TRIP_META) {
    return raw as TravelTripType;
  }
  const key = raw.toLowerCase().replace(/[\s-]/g, '');
  return TRIP_ALIASES[key] ?? 'vacation';
}

export function travelTripMeta(value: unknown) {
  return TRAVEL_TRIP_META[normalizeTripType(value)];
}

export function extractList(response: unknown): unknown[] {
  if (Array.isArray(response)) {
    return response;
  }
  const root = asRecord(response);
  if (Array.isArray(root.items)) {
    return root.items;
  }
  if (Array.isArray(root.data)) {
    return root.data;
  }
  const nested = asRecord(root.data);
  if (Array.isArray(nested.items)) {
    return nested.items;
  }
  return [];
}

export function asCursorPage<T>(
  response: unknown,
  mapItem: (item: unknown) => T | null,
): CursorPage<T> {
  const root = asRecord(response);
  const nested = asRecord(root.data);
  const items = extractList(response)
    .map(mapItem)
    .filter((item): item is T => item != null);
  const cursor =
    asNullableString(root.nextCursor) ?? asNullableString(nested.nextCursor);
  return { items, nextCursor: cursor };
}

function resolveMediaUrl(url: string): string {
  const origin = env.API_URL.replace(/\/$/, '');
  if (url.startsWith('/')) {
    return `${origin}${url}`;
  }
  try {
    const media = new URL(url);
    const api = new URL(origin);
    if (media.hostname === 'localhost' || media.hostname === '127.0.0.1') {
      media.protocol = api.protocol;
      media.hostname = api.hostname;
      media.port = api.port;
      return media.toString();
    }
  } catch {
    return url;
  }
  return url;
}

function normalizePhoto(value: unknown, index: number): Photo | null {
  if (typeof value === 'string' && value.trim()) {
    return {
      id: `photo-${index}`,
      url: resolveMediaUrl(value.trim()),
      position: index,
    };
  }
  const row = asRecord(value);
  const url = resolveMediaUrl(asString(row.url).trim());
  if (!url) {
    return null;
  }
  return {
    id: asId(row.id) || `photo-${index}`,
    url,
    blurhash: asString(row.blurhash) || undefined,
    position: asNumber(row.position, index),
  };
}

export function normalizePhotos(value: unknown): Photo[] {
  return asArray(value)
    .map((item, index) => normalizePhoto(item, index))
    .filter((item): item is Photo => item != null);
}

function normalizeLifestyle(value: unknown): Lifestyle {
  const row = asRecord(value);
  return {
    ethnicity: (asNullableString(row.ethnicity) as Lifestyle['ethnicity']) ?? null,
    bodyType: (asNullableString(row.bodyType) as Lifestyle['bodyType']) ?? null,
    heightRange:
      (asNullableString(row.heightRange) as Lifestyle['heightRange']) ?? null,
    eyeColor: (asNullableString(row.eyeColor) as Lifestyle['eyeColor']) ?? null,
    smoking: (asNullableString(row.smoking) as Lifestyle['smoking']) ?? null,
    drinking: (asNullableString(row.drinking) as Lifestyle['drinking']) ?? null,
    workout: (asNullableString(row.workout) as Lifestyle['workout']) ?? null,
    personality:
      (asNullableString(row.personality) as Lifestyle['personality']) ?? null,
  };
}

export function normalizeProfile(value: unknown): Profile {
  const row = asRecord(value);
  return {
    id: asId(row.id) || asId(row.userId),
    name: asString(row.name, 'Member'),
    age: Math.max(0, Math.round(asNumber(row.age, 0))),
    gender: (asNullableString(row.gender) as Profile['gender']) ?? null,
    sexualOrientation:
      (asNullableString(row.sexualOrientation) as Profile['sexualOrientation']) ??
      null,
    showOrientation: asBoolean(row.showOrientation, true),
    bio: asNullableString(row.bio),
    photos: normalizePhotos(row.photos),
    interests: asStringArray(row.interests),
    languages: asStringArray(row.languages),
    workCategory:
      (asNullableString(row.workCategory) as Profile['workCategory']) ?? null,
    relationshipGoal:
      (asNullableString(row.relationshipGoal) as Profile['relationshipGoal']) ??
      null,
    lifestyle: { ...EMPTY_LIFESTYLE, ...normalizeLifestyle(row.lifestyle) },
    jobTitle: asNullableString(row.jobTitle),
    company: asNullableString(row.company),
    school: asNullableString(row.school),
    heightCm: asNullableNumber(row.heightCm),
    city: asNullableString(row.city),
    locality: asNullableString(row.locality),
    district: asNullableString(row.district),
    region: asNullableString(row.region),
    place: asNullableString(row.place),
    country: asNullableString(row.country),
    countryCode: asNullableString(row.countryCode),
    countryFlag: asNullableString(row.countryFlag),
    isVerified: asBoolean(row.isVerified),
    liked: asBoolean(row.liked),
  };
}

export function normalizeMyProfile(value: unknown): MyProfile {
  const row = asRecord(value);
  return {
    ...normalizeProfile(value),
    birthDate: asNullableString(row.birthDate),
    completeness: asNumber(row.completeness, 0),
  };
}

export function normalizeCandidate(value: unknown): DiscoveryCandidate | null {
  const profile = normalizeProfile(value);
  if (!profile.id) {
    return null;
  }
  const row = asRecord(value);
  return {
    ...profile,
    distanceKm: asNullableNumber(row.distanceKm),
    commonInterests: asStringArray(row.commonInterests),
    isOnline: asBoolean(row.isOnline),
    isNew: asBoolean(row.isNew),
    nationality: asNullableString(row.nationality),
    latitude: asNullableNumber(row.latitude),
    longitude: asNullableNumber(row.longitude),
    mapKind: normalizeMapKind(row.mapKind ?? row.kind),
  };
}

function normalizeMapKind(value: unknown): DiscoveryCandidate['mapKind'] {
  const raw = asString(value);
  if (raw === 'freeTonight' || raw === 'crossedPaths' || raw === 'nearby') {
    return raw;
  }
  return null;
}

export function normalizeTonightPerson(value: unknown): FreeTonightPerson | null {
  const row = asRecord(value);
  const id = asId(row.id);
  if (!id) {
    return null;
  }
  const photo =
    asString(row.photo).trim() ||
    asString(row.featuredPhoto).trim() ||
    primaryPhotoUrl(row.photos) ||
    '';
  return {
    id,
    userId: asId(row.userId) || undefined,
    name: asString(row.name, 'Member'),
    age: Math.max(0, Math.round(asNumber(row.age, 0))),
    photo,
    featuredPhoto: asString(row.featuredPhoto).trim() || photo,
    distanceKm: asNullableNumber(row.distanceKm),
    timeLeft: asString(row.timeLeft),
    endsIn: asString(row.endsIn, asString(row.timeLeft)),
    activity: normalizeTonightActivity(asString(row.activity)),
    flag: asString(row.flag),
    flagCode: asString(row.flagCode),
    countryCode: asNullableString(row.countryCode) ?? undefined,
    countryFlag: asNullableString(row.countryFlag) ?? undefined,
    heightLabel: asString(row.heightLabel),
    venue: asString(row.venue),
    tagline: asString(row.tagline),
    lookingFor: asString(row.lookingFor),
    meetTime: asNullableString(row.meetTime) ?? undefined,
    isOwn: asBoolean(row.isOwn),
    isOnline: asBoolean(row.isOnline),
    isVerified: asBoolean(row.isVerified),
    gender: asString(row.gender, 'woman') === 'man' ? 'man' : 'woman',
    sexualOrientation: asNullableString(row.sexualOrientation),
    viewsLeft: Math.max(0, asNumber(row.viewsLeft, 0)),
    liked: asBoolean(row.liked),
  };
}

function normalizeTravelTags(value: unknown): TravelInterestTag[] {
  return asArray(value).flatMap(item => {
    const row = asRecord(item);
    const id = asId(row.id);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        labelKey: (asString(row.labelKey, 'travel.tagTravelBuddy') ||
          'travel.tagTravelBuddy') as TravelInterestTag['labelKey'],
        icon: (asString(row.icon, 'airplane') ||
          'airplane') as TravelInterestTag['icon'],
        tone: row.tone === 'blue' || row.tone === 'navy' ? row.tone : 'pink',
      },
    ];
  });
}

export function normalizeTravelArrival(value: unknown): TravelArrival | null {
  const row = asRecord(value);
  const id = asId(row.id);
  if (!id) {
    return null;
  }
  const photo = asString(row.photo).trim();
  const cover = asString(row.coverPhoto).trim() || photo;
  return {
    id,
    userId: asId(row.userId) || undefined,
    name: asString(row.name, 'Traveler'),
    age: Math.max(0, Math.round(asNumber(row.age, 0))),
    photo,
    coverPhoto: cover,
    flag: asString(row.flag),
    flagCode: asString(row.flagCode),
    flagUrl: asNullableString(row.flagUrl) ?? undefined,
    nationality: asString(row.nationality),
    from: asString(row.from),
    to: asString(row.to),
    fromCity: asString(row.fromCity),
    fromCountry: asString(row.fromCountry),
    fromCountryCode: asNullableString(row.fromCountryCode) ?? undefined,
    fromCountryFlag: asNullableString(row.fromCountryFlag) ?? undefined,
    toCity: asString(row.toCity),
    toCountry: asString(row.toCountry),
    toFlagCode: asString(row.toFlagCode),
    toCountryFlag: asNullableString(row.toCountryFlag) ?? undefined,
    status: asString(row.status),
    tripType: normalizeTripType(row.tripType),
    city: asString(row.city),
    country: asString(row.country),
    heightLabel: asString(row.heightLabel),
    zodiac: asString(row.zodiac),
    tags: normalizeTravelTags(row.tags),
    arrivalDate: asString(row.arrivalDate),
    returnDate: asNullableString(row.returnDate) ?? undefined,
    purpose: asString(row.purpose),
    travelStyle: asString(row.travelStyle),
    companion: asNullableString(row.companion),
    hideFromCountry: asBoolean(row.hideFromCountry),
    hideFrom: asNullableString(row.hideFrom),
    quote: asString(row.quote),
    isOnline: asBoolean(row.isOnline),
    gender: asNullableString(row.gender),
    sexualOrientation: asNullableString(row.sexualOrientation),
    isVerified: asBoolean(row.isVerified),
    showStatus: asBoolean(row.showStatus, true),
    liked: asBoolean(row.liked),
  };
}

export function normalizeTravelCountry(value: unknown): TravelCountrySummary | null {
  const row = asRecord(value);
  const country = asString(row.country).trim();
  const id = asId(row.id) || (country ? `c-${country.toLowerCase().replace(/\s+/g, '-')}` : '');
  if (!id && !country) {
    return null;
  }
  return {
    id: id || `c-${country.toLowerCase().replace(/\s+/g, '-')}`,
    country: country || 'Country',
    flag: asString(row.flag),
    flagCode: asString(row.flagCode),
    flagUrl: asNullableString(row.flagUrl) ?? undefined,
    arriving: Math.max(0, Math.round(asNumber(row.arriving, 0))),
    extra: Math.max(0, Math.round(asNumber(row.extra, 0))),
    city: asString(row.city),
    accent: asString(row.accent, '#F97316'),
  };
}

export function normalizeJourney(value: unknown): MyJourney | null {
  const row = asRecord(value);
  const id = asId(row.id);
  if (!id) {
    return null;
  }
  const companion = asString(row.companion, 'any');
  const status = asString(row.status, 'upcoming');
  const style = asString(row.travelStyle, 'solo');
  return {
    id,
    fromCity: asString(row.fromCity),
    fromCountry: asString(row.fromCountry),
    fromCountryCode: asNullableString(row.fromCountryCode) ?? undefined,
    fromCountryFlag: asNullableString(row.fromCountryFlag) ?? undefined,
    fromState: asNullableString(row.fromState) ?? undefined,
    toCity: asString(row.toCity),
    toCountry: asString(row.toCountry),
    toCountryCode: asNullableString(row.toCountryCode) ?? undefined,
    toCountryFlag: asNullableString(row.toCountryFlag) ?? undefined,
    toState: asNullableString(row.toState) ?? undefined,
    departure: asString(row.departure),
    returnDate: asString(row.returnDate),
    tripType: normalizeTripType(row.tripType),
    travelStyle:
      style === 'group' || style === 'backpacker' || style === 'couple'
        ? style
        : 'solo',
    companion:
      companion === 'male' || companion === 'female' ? companion : 'any',
    status:
      status === 'active' || status === 'landed' ? status : 'upcoming',
    description: asString(row.description),
    coverImage: asString(row.coverImage),
    hideFromCountry: asBoolean(row.hideFromCountry),
    hideFrom:
      row.hideFrom === 'male' ||
      row.hideFrom === 'female' ||
      row.hideFrom === 'both'
        ? row.hideFrom
        : null,
  };
}

export function normalizeLikeProfile(value: unknown): LikeProfile {
  const profile = normalizeProfile(value);
  const row = asRecord(value);
  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    photos: profile.photos,
    isVerified: profile.isVerified,
    gender: profile.gender,
    relationshipGoal: profile.relationshipGoal,
    isOnline: asBoolean(row.isOnline),
    city: profile.city,
    country: profile.country,
    countryCode: profile.countryCode,
    countryFlag: profile.countryFlag,
    distanceKm: asNullableNumber(row.distanceKm),
  };
}

function withUser(value: unknown): LikeProfile {
  const row = asRecord(value);
  return normalizeLikeProfile(row.user ?? value);
}

export function normalizeMatch(value: unknown): Match | null {
  const row = asRecord(value);
  const user = withUser(value);
  const id = asId(row.id);
  if (!id || !user.id) {
    return null;
  }
  return {
    id,
    conversationId: asId(row.conversationId),
    user,
    matchedAt: asString(row.matchedAt),
    isNew: asBoolean(row.isNew),
  };
}

export function normalizeLikeReceived(value: unknown): LikeReceived | null {
  const row = asRecord(value);
  const user = withUser(value);
  const id = asId(row.id);
  if (!id || !user.id) {
    return null;
  }
  return {
    id,
    user,
    isSuperlike: asBoolean(row.isSuperlike),
    likedAt: asString(row.likedAt),
  };
}

export function normalizeLikeSent(value: unknown): LikeSent | null {
  const row = asRecord(value);
  const user = withUser(value);
  const id = asId(row.id);
  if (!id || !user.id) {
    return null;
  }
  return {
    id,
    user,
    likedAt: asString(row.likedAt),
  };
}

export function normalizeProfileView(value: unknown): ProfileView | null {
  const row = asRecord(value);
  const user = withUser(value);
  const id = asId(row.id);
  if (!id || !user.id) {
    return null;
  }
  return {
    id,
    user,
    viewedAt: asString(row.viewedAt),
  };
}

export function normalizeMessage(value: unknown): ChatMessage | null {
  const row = asRecord(value);
  const id = asId(row.id);
  if (!id) {
    return null;
  }
  const status = asString(row.status, 'sent');
  return {
    id,
    clientId: asNullableString(row.clientId),
    conversationId: asId(row.conversationId),
    senderId: asId(row.senderId),
    body: asString(row.body),
    createdAt: asString(row.createdAt),
    status:
      status === 'sending' ||
      status === 'delivered' ||
      status === 'read' ||
      status === 'failed'
        ? status
        : 'sent',
  };
}

export function normalizeConversation(value: unknown): Conversation | null {
  const row = asRecord(value);
  const id = asId(row.id);
  const user = normalizeLikeProfile(row.user);
  if (!id || !user.id) {
    return null;
  }
  const last = row.lastMessage == null ? null : normalizeMessage(row.lastMessage);
  return {
    id,
    matchId: asId(row.matchId),
    user,
    lastMessage: last,
    unreadCount: Math.max(0, asNumber(row.unreadCount, 0)),
    updatedAt: asString(row.updatedAt),
    isRequest: asBoolean(row.isRequest),
  };
}

export function normalizeNotification(value: unknown): InboxNotification | null {
  const row = asRecord(value);
  const id = asId(row.id);
  if (!id) {
    return null;
  }
  return {
    id,
    type: asString(row.type),
    title: asString(row.title),
    body: asString(row.body),
    data: isRecord(row.data) ? row.data : undefined,
    relatedEntityType: asNullableString(row.relatedEntityType),
    relatedEntityId: asNullableString(row.relatedEntityId),
    isRead: asBoolean(row.isRead),
    createdAt: asNullableString(row.createdAt),
    time: asNullableString(row.time) ?? undefined,
  };
}

export function normalizeBlockedUser(value: unknown): BlockedUser | null {
  const row = asRecord(value);
  const id = asId(row.id);
  if (!id) {
    return null;
  }
  return {
    id,
    name: asString(row.name, 'Member'),
    age: asNullableNumber(row.age) ?? undefined,
    photos: normalizePhotos(row.photos),
    isVerified: asBoolean(row.isVerified),
  };
}

export function normalizeDiscoveryPreferences(
  value: unknown,
): DiscoveryPreferences {
  const row = asRecord(value);
  return {
    ...EMPTY_DISCOVERY_PREFERENCES,
    minAge: asNumber(row.minAge, EMPTY_DISCOVERY_PREFERENCES.minAge),
    maxAge: asNumber(row.maxAge, EMPTY_DISCOVERY_PREFERENCES.maxAge),
    maxDistanceKm: asNumber(
      row.maxDistanceKm,
      EMPTY_DISCOVERY_PREFERENCES.maxDistanceKm,
    ),
    interestedIn: asStringArray(row.interestedIn) as DiscoveryPreferences['interestedIn'],
    isDiscoverable: asBoolean(row.isDiscoverable, true),
    verifiedOnly: asBoolean(row.verifiedOnly),
    onlineOnly: asBoolean(row.onlineOnly),
    nationality: asNullableString(row.nationality),
    relationshipGoals: asStringArray(
      row.relationshipGoals,
    ) as DiscoveryPreferences['relationshipGoals'],
    bodyTypes: asStringArray(row.bodyTypes) as DiscoveryPreferences['bodyTypes'],
    drinking: asStringArray(row.drinking) as DiscoveryPreferences['drinking'],
    workout: asStringArray(row.workout) as DiscoveryPreferences['workout'],
    personality: asStringArray(
      row.personality,
    ) as DiscoveryPreferences['personality'],
    heightRanges: asStringArray(
      row.heightRanges,
    ) as DiscoveryPreferences['heightRanges'],
    interests: asStringArray(row.interests),
    languages: asStringArray(row.languages),
    workCategories: asStringArray(
      row.workCategories,
    ) as DiscoveryPreferences['workCategories'],
    matchOrientations: asStringArray(row.matchOrientations),
  };
}

export function normalizeNotificationSettings(
  value: unknown,
): NotificationSettings {
  const row = asRecord(value);
  return {
    all: asBoolean(row.all, true),
    messages: asBoolean(row.messages, true),
    matches: asBoolean(row.matches, true),
    likes: asBoolean(row.likes, true),
    profileViews: asBoolean(row.profileViews, true),
    crossPath: asBoolean(row.crossPath, true),
    travellerAlerts: asBoolean(row.travellerAlerts, true),
    freeTonight: asBoolean(row.freeTonight, true),
    email: asBoolean(row.email, true),
  };
}

export function normalizeSubscription(value: unknown): Subscription {
  const row = asRecord(value);
  const entitlements = asRecord(row.entitlements);
  const tier = asString(row.tier, 'free');
  return {
    tier: tier === 'plus' || tier === 'gold' ? tier : 'free',
    expiresAt: asNullableString(row.expiresAt),
    willRenew: asBoolean(row.willRenew),
    entitlements: {
      unlimitedLikes: asBoolean(entitlements.unlimitedLikes),
      seeWhoLikedYou: asBoolean(entitlements.seeWhoLikedYou),
      rewind: asBoolean(entitlements.rewind),
      superlikesPerDay: asNumber(entitlements.superlikesPerDay, 0),
      boostsPerMonth: asNumber(entitlements.boostsPerMonth, 0),
    },
  };
}
