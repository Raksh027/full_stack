import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

import type {
  AuthProvider,
  AuthResponse,
  SessionUser,
} from '@/features/auth/types';
import type { UpdateProfileRequest } from '@/features/profile/types';
import type {
  DiscoveryPreferences,
  NotificationSettings,
} from '@/features/settings/types';
import { logger } from '@/services/logger/logger';
import { tokenManager } from '@/services/session/tokenManager';
import { calculateAge, parseISODate } from '@/shared/utils/date';
import { createClientId } from '@/shared/utils/id';

import {
  createEmptyProfile,
  DEFAULT_DISCOVERY_PREFERENCES,
  DEFAULT_NOTIFICATION_SETTINGS,
  ensureUser,
  readDb,
  writeDb,
  type MockUser,
} from './mockDatabase';
import {
  ensureMockConversation,
  listMockConversations,
  listMockMessages,
  markMockConversationRead,
  sendMockMessage,
} from './mockChat';
import {
  acceptMockLike,
  hasMockLikedUser,
  listMockLikesReceived,
  listMockLikesSent,
  listMockMatches,
  listMockProfileViews,
  passMockLike,
  recordMockLikeSent,
  recordMockProfileView,
  removeMockLikeSent,
} from './mockLikes';
import {
  discoveryAudienceFromProfile,
  matchesDiscoveryAudience,
} from '@/features/discovery/utils/discoveryAudience';

import {
  MOCK_TRAVEL_ARRIVALS,
  MOCK_TRAVEL_COUNTRIES,
} from '@/features/discovery/data/mockTravelArrivals';
import {
  MOCK_FREE_TONIGHT,
  normalizeTonightActivity,
} from '@/features/discovery/data/mockFreeTonight';
import { findMockPublicProfile, MOCK_DISCOVERY_FEED } from './mockDiscovery';
import { mockUploadUrl, takeMockUpload } from './mockMedia';

const LATENCY_MS = 400;

type Result = { data: unknown } | { error: FetchBaseQueryError };
type Body = Record<string, unknown> | undefined;
type Handler = (params: {
  match: RegExpMatchArray;
  body: Body;
  userId: string | null;
  search: string;
}) => Result;
type Route = [method: string, pattern: RegExp, handler: Handler];

const mockTonightByUser = new Map<string, Record<string, unknown>>();
const mockInboxByUser = new Map<
  string,
  Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    relatedEntityType: string;
    relatedEntityId: string;
    isRead: boolean;
    createdAt: string;
  }>
>();

function mockInboxFor(userId: string) {
  const existing = mockInboxByUser.get(userId);
  if (existing) {
    return existing;
  }
  const people = MOCK_DISCOVERY_FEED;
  const now = Date.now();
  const row = (
    index: number,
    type: string,
    title: string,
    body: string,
    kind: string,
    minutesAgo: number,
  ) => {
    const person = people[index] ?? people[0]!;
    const createdAt = new Date(now - minutesAgo * 60_000).toISOString();
    return {
      id: `mock-n-${kind}-${person.id}`,
      type,
      title,
      body: body.replace('{{name}}', person.name),
      data: {
        type,
        kind,
        userId: person.id,
        user_id: person.id,
        name: person.name,
        photo: person.photos[0]?.url ?? null,
      },
      relatedEntityType: 'user',
      relatedEntityId: person.id,
      isRead: minutesAgo > 180,
      createdAt,
    };
  };
  const rows = [
    row(0, 'LIKE_RECEIVED', 'New like', '{{name}} liked your profile', 'like', 12),
    row(1, 'OFFER_RECEIVED', 'New offer', '{{name}} sent you a Super Like', 'offer', 40),
    row(2, 'MATCH_CREATED', "It's a match", 'You and {{name}} liked each other', 'match', 90),
    row(3, 'PROFILE_VIEW', 'Profile view', '{{name}} viewed your profile', 'view', 140),
    row(4, 'LIKE_RECEIVED', 'New like', '{{name}} liked your profile', 'like', 400),
  ];
  mockInboxByUser.set(userId, rows);
  return rows;
}

const fail = (status: number, detail: string): Result => ({
  error: { status, data: { detail } },
});

const ok = (data: unknown = { ok: true }): Result => ({ data });

const EMAIL_CHANGE_MS = 30 * 24 * 60 * 60 * 1000;

function mockEmailChangeStatus(user: MockUser) {
  const cooldownDays = 30;
  const changed = user.emailChangedAt ? Date.parse(user.emailChangedAt) : NaN;
  if (!Number.isFinite(changed)) {
    return {
      email: user.email ?? '',
      canChange: true,
      nextChangeAt: null as string | null,
      daysRemaining: 0,
      cooldownDays,
    };
  }
  const next = changed + EMAIL_CHANGE_MS;
  const remaining = next - Date.now();
  if (remaining <= 0) {
    return {
      email: user.email ?? '',
      canChange: true,
      nextChangeAt: new Date(next).toISOString(),
      daysRemaining: 0,
      cooldownDays,
    };
  }
  return {
    email: user.email ?? '',
    canChange: false,
    nextChangeAt: new Date(next).toISOString(),
    daysRemaining: Math.max(1, Math.ceil(remaining / 86_400_000)),
    cooldownDays,
  };
}

function paginate<T>(items: T[], search: string, fallbackLimit = 20) {
  const params = new URLSearchParams(search);
  const limit = Number(params.get('limit') || fallbackLimit);
  const cursor = params.get('cursor');
  const offset = cursor ? Math.max(0, Number(cursor) || 0) : 0;
  const size = Number.isFinite(limit) && limit > 0 ? limit : fallbackLimit;
  const page = items.slice(offset, offset + size);
  return {
    items: page,
    nextCursor: offset + size < items.length ? String(offset + size) : null,
  };
}

function sessionFor(user: MockUser): AuthResponse {
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    provider: user.provider,
    isOnboarded: user.isOnboarded,
    isPremium: user.isPremium,
    isEmailVerified: user.isEmailVerified,
  };
  return {
    tokens: {
      accessToken: `mock.${user.id}`,
      refreshToken: `mock-refresh.${user.id}`,
    },
    user: sessionUser,
    isNewUser: false,
  };
}

function createUser(
  email: string,
  provider: AuthProvider,
  password: string | null,
  isEmailVerified = provider !== 'email',
): MockUser {
  const user: MockUser = {
    id: createClientId(),
    email,
    provider,
    password,
    isOnboarded: false,
    isPremium: false,
    isEmailVerified,
  };
  writeDb(db => {
    db.users[user.id] = user;
    db.profiles[user.id] = createEmptyProfile(user.id);
  });
  return user;
}

function findUserByEmail(email: string) {
  return Object.values(readDb().users).find(user => user.email === email);
}

function socialSignIn(
  provider: AuthProvider,
  body?: { fullName?: { givenName?: string | null; familyName?: string | null } },
): Result {
  const email = `${provider}.user@example.com`;
  const user = findUserByEmail(email) ?? createUser(email, provider, null);
  const appleName = [body?.fullName?.givenName, body?.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const fallbackName =
    provider === 'google'
      ? 'Alex Rivera'
      : provider === 'apple'
        ? 'Alex Apple'
        : 'Alex Morgan';
  writeDb(db => {
    const profile = db.profiles[user.id];
    if (!profile) {
      return;
    }
    if (!profile.name.trim()) {
      profile.name = appleName || fallbackName;
    }
    if (!profile.birthDate) {
      profile.birthDate = provider === 'facebook' ? '1995-08-21' : '1996-04-12';
      profile.age = provider === 'facebook' ? 31 : 30;
    }
    if (!profile.gender) {
      profile.gender = provider === 'facebook' ? 'woman' : 'man';
    }
  });
  return ok(sessionFor(user));
}

function requireUser(userId: string | null): MockUser | Result {
  if (!userId) {
    return fail(401, 'Not authenticated');
  }
  return ensureUser(userId);
}

function isResult(value: MockUser | Result): value is Result {
  return 'data' in value || 'error' in value;
}

const routes: Route[] = [
  [
    'POST',
    /^\/auth\/register$/,
    ({ body }) => {
      const email = String(body?.email ?? '').toLowerCase();
      const password = String(body?.password ?? '');
      const existing = findUserByEmail(email);
      if (existing) {
        writeDb(db => {
          db.users[existing.id]!.password = password;
        });
        return ok(sessionFor(readDb().users[existing.id]!));
      }
      return ok({
        ...sessionFor(createUser(email, 'email', password)),
        isNewUser: true,
      });
    },
  ],
  [
    'POST',
    /^\/auth\/login$/,
    ({ body }) => {
      // Any credentials that pass client-side validation sign in; unknown
      // emails get a verified account so the flow continues to onboarding.
      const email = String(body?.email ?? '').toLowerCase();
      const user =
        findUserByEmail(email) ??
        createUser(email, 'email', String(body?.password ?? ''), true);
      return ok(sessionFor(user));
    },
  ],
  ['POST', /^\/auth\/google$/, () => socialSignIn('google')],
  [
    'POST',
    /^\/auth\/apple$/,
    ({ body }) => socialSignIn('apple', body as { fullName?: { givenName?: string | null; familyName?: string | null } }),
  ],
  ['POST', /^\/auth\/facebook$/, () => socialSignIn('facebook')],
  ['POST', /^\/auth\/otp\/request$/, () => ok()],
  [
    'POST',
    /^\/auth\/otp\/verify$/,
    ({ body }) => {
      const email = String(body?.email ?? '').toLowerCase();
      const existing = findUserByEmail(email);
      const user = existing ?? createUser(email, 'email', null, true);
      writeDb(db => {
        db.users[user.id]!.isEmailVerified = true;
      });
      return ok({
        ...sessionFor(readDb().users[user.id]!),
        isNewUser: !existing,
      });
    },
  ],
  ['POST', /^\/auth\/password\/forgot$/, () => ok()],
  ['POST', /^\/auth\/logout$/, () => ok()],
  ['POST', /^\/auth\/email\/verify\/resend$/, () => ok()],
  [
    'POST',
    /^\/auth\/email\/verify$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      writeDb(db => {
        db.users[user.id]!.isEmailVerified = true;
      });
      return ok(sessionFor(readDb().users[user.id]!).user);
    },
  ],
  [
    'GET',
    /^\/users\/me\/email-change$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(mockEmailChangeStatus(user));
    },
  ],
  [
    'POST',
    /^\/users\/me\/email-change\/request$/,
    ({ body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const status = mockEmailChangeStatus(user);
      if (!status.canChange) {
        return fail(
          429,
          `You can change your email again in ${status.daysRemaining} days.`,
        );
      }
      const email = String(body?.email ?? '').trim().toLowerCase();
      if (!email.includes('@')) {
        return fail(400, 'Enter a valid email address.');
      }
      if (email === (user.email ?? '').toLowerCase()) {
        return fail(400, 'That is already your current email.');
      }
      const taken = findUserByEmail(email);
      if (taken && taken.id !== user.id) {
        return fail(409, 'This email is already used by another account.');
      }
      writeDb(db => {
        db.users[user.id]!.pendingEmailChange = email;
      });
      return ok({ otpSent: true, email });
    },
  ],
  [
    'POST',
    /^\/users\/me\/email-change\/verify$/,
    ({ body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const status = mockEmailChangeStatus(user);
      if (!status.canChange) {
        return fail(
          429,
          `You can change your email again in ${status.daysRemaining} days.`,
        );
      }
      const email = String(body?.email ?? '').trim().toLowerCase();
      const code = String(body?.code ?? '').trim();
      if (!code || code.length < 4) {
        return fail(400, 'Invalid OTP.');
      }
      if (!user.pendingEmailChange || user.pendingEmailChange !== email) {
        return fail(400, 'Request a new OTP for this email first.');
      }
      const taken = findUserByEmail(email);
      if (taken && taken.id !== user.id) {
        return fail(409, 'This email is already used by another account.');
      }
      writeDb(db => {
        const next = db.users[user.id]!;
        next.email = email;
        next.isEmailVerified = true;
        next.emailChangedAt = new Date().toISOString();
        next.pendingEmailChange = null;
      });
      return ok(sessionFor(readDb().users[user.id]!).user);
    },
  ],
  [
    'GET',
    /^\/auth\/me$/,
    ({ userId }) => {
      const user = requireUser(userId);
      return isResult(user) ? user : ok(sessionFor(user).user);
    },
  ],
  [
    'DELETE',
    /^\/users\/me$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) {
        return user;
      }
      writeDb(db => {
        delete db.users[user.id];
        delete db.profiles[user.id];
        delete db.discoveryPreferences[user.id];
        delete db.notificationSettings[user.id];
      });
      return ok({ deleted: true, permanent: true });
    },
  ],

  [
    'GET',
    /^\/profiles\/me$/,
    ({ userId }) => {
      const user = requireUser(userId);
      return isResult(user) ? user : ok(readDb().profiles[user.id]);
    },
  ],
  [
    'GET',
    /^\/profiles\/([^/]+)$/,
    ({ match, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const profileId = match[1]!;
      if (profileId === user.id) {
        return ok(readDb().profiles[user.id]);
      }
      const profile = findMockPublicProfile(profileId);
      return profile
        ? ok({ ...profile, liked: hasMockLikedUser(profileId) })
        : fail(404, 'Profile not found');
    },
  ],
  [
    'PATCH',
    /^\/profiles\/me$/,
    ({ body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const { lifestyle, ...fields } = (body ?? {}) as UpdateProfileRequest;
      writeDb(db => {
        const profile = db.profiles[user.id]!;
        Object.assign(profile, fields);
        if (lifestyle) {
          profile.lifestyle = { ...profile.lifestyle, ...lifestyle };
        }
        const birthDate = profile.birthDate
          ? parseISODate(profile.birthDate)
          : null;
        profile.age = birthDate ? calculateAge(birthDate) : 0;
      });
      return ok(readDb().profiles[user.id]);
    },
  ],
  [
    'POST',
    /^\/profiles\/me\/onboarding\/complete$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      writeDb(db => {
        db.users[user.id]!.isOnboarded = true;
      });
      return ok(readDb().profiles[user.id]);
    },
  ],
  [
    'PUT',
    /^\/profiles\/me\/location$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const location = { city: 'Cupertino', country: 'United States' };
      writeDb(db => Object.assign(db.profiles[user.id]!, location));
      return ok(location);
    },
  ],
  [
    'POST',
    /^\/profiles\/me\/photos\/upload-url$/,
    () => {
      const photoId = createClientId();
      return ok({
        photoId,
        uploadUrl: mockUploadUrl(photoId),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
    },
  ],
  [
    'POST',
    /^\/profiles\/me\/photos\/([^/]+)\/confirm$/,
    ({ match, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const photoId = match[1]!;
      const url = takeMockUpload(photoId);
      if (!url) return fail(404, 'Upload not found');
      let photo;
      writeDb(db => {
        const photos = db.profiles[user.id]!.photos;
        photo = { id: photoId, url, position: photos.length };
        photos.push(photo);
      });
      return ok(photo);
    },
  ],
  [
    'PUT',
    /^\/profiles\/me\/photos\/order$/,
    ({ body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const order = (body?.photoIds ?? []) as string[];
      writeDb(db => {
        const profile = db.profiles[user.id]!;
        profile.photos = order
          .map((id, position) => {
            const photo = profile.photos.find(p => p.id === id);
            return photo ? { ...photo, position } : undefined;
          })
          .filter(photo => photo !== undefined);
      });
      return ok();
    },
  ],
  [
    'DELETE',
    /^\/profiles\/me\/photos\/([^/]+)$/,
    ({ match, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      writeDb(db => {
        const profile = db.profiles[user.id]!;
        profile.photos = profile.photos
          .filter(photo => photo.id !== match[1])
          .map((photo, position) => ({ ...photo, position }));
      });
      return ok();
    },
  ],

  [
    'GET',
    /^\/users\/me\/discovery-preferences$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(
        readDb().discoveryPreferences[user.id] ?? DEFAULT_DISCOVERY_PREFERENCES,
      );
    },
  ],
  [
    'PATCH',
    /^\/users\/me\/discovery-preferences$/,
    ({ body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      writeDb(db => {
        db.discoveryPreferences[user.id] = {
          ...DEFAULT_DISCOVERY_PREFERENCES,
          ...db.discoveryPreferences[user.id],
          ...(body as Partial<DiscoveryPreferences>),
        };
      });
      return ok(readDb().discoveryPreferences[user.id]);
    },
  ],
  [
    'GET',
    /^\/users\/me\/notification-settings$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(
        readDb().notificationSettings?.[user.id] ??
          DEFAULT_NOTIFICATION_SETTINGS,
      );
    },
  ],
  [
    'PATCH',
    /^\/users\/me\/notification-settings$/,
    ({ body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      writeDb(db => {
        if (!db.notificationSettings) {
          db.notificationSettings = {};
        }
        db.notificationSettings[user.id] = {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...db.notificationSettings[user.id],
          ...(body as Partial<NotificationSettings>),
        };
      });
      return ok(readDb().notificationSettings[user.id]);
    },
  ],
  [
    'GET',
    /^\/discovery\/feed$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const profile = readDb().profiles[user.id];
      const audience = discoveryAudienceFromProfile(
        profile?.gender,
        profile?.sexualOrientation,
      );
      const items = MOCK_DISCOVERY_FEED.filter(card =>
        matchesDiscoveryAudience(card, audience),
      );
      return ok(paginate(items, search, 20));
    },
  ],
  [
    'GET',
    /^\/discovery\/map$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const profile = readDb().profiles[user.id];
      const audience = discoveryAudienceFromProfile(
        profile?.gender,
        profile?.sexualOrientation,
      );
      const params = new URLSearchParams(search);
      const originLat = Number(params.get('latitude') || 28.6328);
      const originLng = Number(params.get('longitude') || 77.2197);
      const radiusKm = Number(params.get('radiusKm') || 10);
      const kind = params.get('kind') || 'all';
      const onlineOnly = params.get('onlineOnly') === 'true';
      const items = MOCK_DISCOVERY_FEED.filter(card =>
        matchesDiscoveryAudience(card, audience),
      )
        .filter(card => (card.distanceKm ?? 99) <= radiusKm)
        .filter(card => !onlineOnly || card.isOnline)
        .map((card, index) => {
          const angle = ((index * 47) % 360) * (Math.PI / 180);
          const km = card.distanceKm ?? 4;
          const latitude = originLat + (km * Math.cos(angle)) / 111.32;
          const longitude =
            originLng +
            (km * Math.sin(angle)) /
              (111.32 * Math.max(Math.cos((originLat * Math.PI) / 180), 0.2));
          const mapKind = card.isOnline
            ? 'freeTonight'
            : km <= 2
              ? 'crossedPaths'
              : 'nearby';
          return { ...card, latitude, longitude, mapKind };
        })
        .filter(card => kind === 'all' || card.mapKind === kind);
      return ok(paginate(items, search, 30));
    },
  ],
  [
    'POST',
    /^\/discovery\/swipes$/,
    ({ userId, body }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const targetUserId = String(body?.targetUserId ?? '');
      const action = String(body?.action ?? '');
      const created =
        action === 'like' && targetUserId
          ? recordMockLikeSent(targetUserId)
          : null;
      return ok({
        match: created?.match ?? null,
        remainingLikes: null,
        remainingSuperlikes: null,
      });
    },
  ],
  [
    'GET',
    /^\/likes\/sent$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(paginate(listMockLikesSent().items, search, 20));
    },
  ],
  [
    'GET',
    /^\/likes\/received$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(paginate(listMockLikesReceived().items, search, 20));
    },
  ],
  [
    'GET',
    /^\/likes\/viewed$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(paginate(listMockProfileViews().items, search, 20));
    },
  ],
  [
    'GET',
    /^\/matches$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(paginate(listMockMatches(user.id).items, search, 20));
    },
  ],
  [
    'POST',
    /^\/likes\/received\/([^/]+)\/respond$/,
    ({ match, body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const action = String(body?.action ?? '');
      if (action === 'like') {
        return ok(acceptMockLike(match[1]!));
      }
      passMockLike(match[1]!);
      return ok({ match: null });
    },
  ],
  [
    'DELETE',
    /^\/likes\/sent\/([^/]+)$/,
    ({ match, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      removeMockLikeSent(match[1]!);
      return ok();
    },
  ],
  [
    'POST',
    /^\/profiles\/([^/]+)\/views$/,
    ({ match, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      recordMockProfileView(match[1]!);
      return ok();
    },
  ],
  [
    'POST',
    /^\/safety\/blocks$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok();
    },
  ],
  [
    'POST',
    /^\/safety\/reports$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok();
    },
  ],
  [
    'GET',
    /^\/conversations$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(paginate(listMockConversations(user.id), search, 20));
    },
  ],
  [
    'POST',
    /^\/conversations$/,
    ({ body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const targetId = String(body?.userId ?? '').trim();
      const text = String(body?.body ?? body?.content ?? '').trim();
      if (!targetId) {
        return fail(400, 'User is required');
      }
      if (!text) {
        return fail(400, 'Message cannot be empty');
      }
      const profile = findMockPublicProfile(targetId);
      const conversation = ensureMockConversation({
        userId: targetId,
        name: profile?.name ?? 'Member',
        age: profile?.age ?? 0,
        isVerified: Boolean(profile?.isVerified),
        photoUrl: profile?.photos?.[0]?.url,
      });
      const message = sendMockMessage(
        conversation.id,
        user.id,
        String(body?.clientId ?? createClientId()),
        text,
      );
      const latest =
        listMockConversations(user.id).find(item => item.id === conversation.id) ??
        { ...conversation, lastMessage: message };
      return ok({ conversation: latest, message });
    },
  ],
  [
    'GET',
    /^\/conversations\/([^/]+)\/messages$/,
    ({ match, userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const newestFirst = listMockMessages(match[1]!, user.id);
      const paged = paginate(newestFirst, search, 30);
      return ok({
        items: [...paged.items].reverse(),
        nextCursor: paged.nextCursor,
      });
    },
  ],
  [
    'POST',
    /^\/conversations\/([^/]+)\/messages$/,
    ({ match, body, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const text = String(body?.body ?? '').trim();
      if (!text) {
        return fail(400, 'Message cannot be empty');
      }
      return ok(
        sendMockMessage(
          match[1]!,
          user.id,
          String(body?.clientId ?? createClientId()),
          text,
        ),
      );
    },
  ],
  [
    'POST',
    /^\/conversations\/([^/]+)\/read$/,
    ({ match, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      markMockConversationRead(match[1]!);
      return ok();
    },
  ],
  [
    'GET',
    /^\/travel\/countries$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const params = new URLSearchParams(search);
      const q = (params.get('q') || '').trim().toLowerCase();
      const items = q
        ? MOCK_TRAVEL_COUNTRIES.filter(item =>
            item.country.toLowerCase().includes(q),
          )
        : MOCK_TRAVEL_COUNTRIES;
      return ok(paginate(items, search, 20));
    },
  ],
  [
    'GET',
    /^\/travel\/arrivals$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const params = new URLSearchParams(search);
      const fromCountry = params.get('fromCountry');
      const tripType = params.get('tripType');
      const fromDate = params.get('fromDate');
      const toDate = params.get('toDate');
      const travelStyle = (params.get('travelStyle') || '').toLowerCase();
      const companion = (params.get('companion') || '').toLowerCase();
      const items = MOCK_TRAVEL_ARRIVALS.filter(item => {
        if (fromCountry && item.fromCountry !== fromCountry) {
          return false;
        }
        if (tripType && item.tripType !== tripType) {
          return false;
        }
        if (
          travelStyle &&
          (item.travelStyle || '').toLowerCase() !== travelStyle
        ) {
          return false;
        }
        if (companion) {
          const wanted = companion;
          const itemCompanion = (item.companion || 'any').toLowerCase();
          const itemGender = (item.gender || '').toLowerCase();
          const genderToken =
            itemGender === 'man' || itemGender === 'male' || itemGender === 'm'
              ? 'male'
              : itemGender === 'woman' ||
                  itemGender === 'female' ||
                  itemGender === 'f'
                ? 'female'
                : itemGender;
          if (
            itemCompanion !== wanted &&
            !(
              (wanted === 'male' || wanted === 'female') &&
              genderToken === wanted
            )
          ) {
            return false;
          }
        }
        if (fromDate || toDate) {
          const arrived = new Date(item.arrivalDate).getTime();
          if (!Number.isFinite(arrived)) {
            return false;
          }
          if (fromDate) {
            const start = new Date(fromDate).getTime();
            if (Number.isFinite(start) && arrived < start) {
              return false;
            }
          }
          if (toDate) {
            const end = new Date(toDate).getTime();
            if (Number.isFinite(end) && arrived > end + 24 * 60 * 60 * 1000 - 1) {
              return false;
            }
          }
        }
        return true;
      });
      return ok(paginate(items, search, 12));
    },
  ],
  [
    'GET',
    /^\/travel\/arrivals\/([^/]+)$/,
    ({ userId, match }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const arrival = MOCK_TRAVEL_ARRIVALS.find(item => item.id === match[1]);
      return arrival ? ok(arrival) : fail(404, 'Traveler not found');
    },
  ],
  [
    'GET',
    /^\/travel\/journeys$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(paginate([], search, 20));
    },
  ],
  [
    'GET',
    /^\/travel\/journeys\/([^/]+)$/,
    ({ userId, match }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok({
        id: match[1],
        fromCity: '',
        fromCountry: '',
        toCity: '',
        toCountry: '',
        departure: '',
        returnDate: '',
        tripType: 'vacation',
        travelStyle: 'solo',
        companion: 'any',
        status: 'upcoming',
        description: '',
        coverImage: '',
        hideFromCountry: false,
      });
    },
  ],
  [
    'POST',
    /^\/travel\/journeys$/,
    ({ userId, body }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok({
        id: createClientId(),
        ...((body as Record<string, unknown>) ?? {}),
      });
    },
  ],
  [
    'PATCH',
    /^\/travel\/journeys\/([^/]+)$/,
    ({ userId, match, body }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok({
        id: match[1],
        ...((body as Record<string, unknown>) ?? {}),
      });
    },
  ],
  [
    'DELETE',
    /^\/travel\/journeys\/([^/]+)$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok();
    },
  ],
  [
    'GET',
    /^\/tonight\/me$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok({ item: mockTonightByUser.get(user.id) ?? null });
    },
  ],
  [
    'GET',
    /^\/tonight$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const params = new URLSearchParams(search);
      const activity = params.get('activity');
      const minRaw = params.get('minKm');
      const maxRaw = params.get('maxKm');
      const minKm = minRaw == null || minRaw === '' ? null : Number(minRaw);
      const maxKm = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
      const unbounded =
        (minKm == null || minKm <= 0) && (maxKm == null || maxKm >= 150);
      const wanted = activity
        ? normalizeTonightActivity(activity)
        : null;
      const fromUsers = [...mockTonightByUser.entries()]
        .filter(([ownerId]) => ownerId !== user.id)
        .map(([, post]) => ({ ...post, isOwn: false }));
      const items = [...fromUsers, ...MOCK_FREE_TONIGHT].filter(item => {
        if (wanted && normalizeTonightActivity(String(item.activity ?? '')) !== wanted) {
          return false;
        }
        const km =
          typeof item.distanceKm === 'number' ? item.distanceKm : null;
        if (unbounded) {
          return true;
        }
        if (km == null) {
          return false;
        }
        if (minKm != null && km < minKm) {
          return false;
        }
        if (maxKm != null && km > maxKm) {
          return false;
        }
        return true;
      });
      return ok(paginate(items, search, 12));
    },
  ],
  [
    'POST',
    /^\/tonight$/,
    ({ userId, body }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      if (mockTonightByUser.has(user.id)) {
        return fail(409, 'You already have a Free Tonight. You can create another after it ends.');
      }
      const created = {
        id: createClientId(),
        userId: user.id,
        name: 'You',
        isOwn: true,
        ...((body as Record<string, unknown>) ?? {}),
      };
      mockTonightByUser.set(user.id, created);
      return ok(created);
    },
  ],
  [
    'PATCH',
    /^\/tonight$/,
    ({ userId, body }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const existing = mockTonightByUser.get(user.id);
      if (!existing) {
        return fail(404, 'Free Tonight not found.');
      }
      const next = {
        ...existing,
        ...((body as Record<string, unknown>) ?? {}),
        meetTime:
          (body as Record<string, unknown>)?.time ??
          (body as Record<string, unknown>)?.meetTime ??
          existing.meetTime,
        venue:
          (body as Record<string, unknown>)?.venue ?? existing.venue,
        isOwn: true,
      };
      mockTonightByUser.set(user.id, next);
      return ok(next);
    },
  ],
  [
    'DELETE',
    /^\/tonight$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      if (!mockTonightByUser.has(user.id)) {
        return fail(404, 'Free Tonight not found.');
      }
      mockTonightByUser.delete(user.id);
      return ok({ deleted: true });
    },
  ],
  [
    'POST',
    /^\/verification\/start$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok({ status: 'pending' });
    },
  ],
  [
    'POST',
    /^\/verification\/upload-url$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const photoId = createClientId();
      return ok({
        uploadUrl: mockUploadUrl(photoId),
        storageKey: `verification/${photoId}`,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    },
  ],
  [
    'GET',
    /^\/notifications\/unread-count$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const count = mockInboxFor(user.id).filter(item => !item.isRead).length;
      return ok({ count });
    },
  ],
  [
    'GET',
    /^\/notifications$/,
    ({ userId, search }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok(paginate(mockInboxFor(user.id), search, 20));
    },
  ],
  [
    'POST',
    /^\/notifications\/read-all$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      mockInboxFor(user.id).forEach(item => {
        item.isRead = true;
      });
      return ok({ updated: true });
    },
  ],
  [
    'POST',
    /^\/notifications\/([^/]+)\/read$/,
    ({ match, userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      const item = mockInboxFor(user.id).find(row => row.id === match[1]);
      if (item) {
        item.isRead = true;
      }
      return ok({ id: match[1], isRead: true });
    },
  ],
  [
    'POST',
    /^\/verification\/submit$/,
    ({ userId }) => {
      const user = requireUser(userId);
      if (isResult(user)) return user;
      return ok({ status: 'pending' });
    },
  ],
];

/** Serves API requests from an on-device store so the UI can run without the backend. */
export const mockBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async args => {
  const {
    url,
    method = 'GET',
    body,
  } = typeof args === 'string' ? { url: args } : args;
  const [path, search = ''] = url.split('?');
  await new Promise<void>(resolve => setTimeout(resolve, LATENCY_MS));

  const accessToken = tokenManager.getAccessToken();
  const userId = accessToken?.startsWith('mock.')
    ? accessToken.slice('mock.'.length)
    : null;

  for (const [routeMethod, pattern, handler] of routes) {
    const match = path.match(pattern);
    if (match && routeMethod === method.toUpperCase()) {
      return handler({ match, body: body as Body, userId, search });
    }
  }

  if (method.toUpperCase() === 'GET') {
    return ok({ items: [], nextCursor: null });
  }
  logger.warn(`[mock api] No mock for ${method} ${path}`);
  return fail(404, `No mock for ${method} ${path}`);
};
