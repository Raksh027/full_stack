import type {
  LikeProfile,
  LikeReceived,
  LikeResponseResult,
  LikeSent,
  Match,
  ProfileView,
} from '@/features/matches/types';

import { ensureMockConversation, listMockConversations } from './mockChat';
import { findMockPublicProfile } from './mockDiscovery';

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function toLikeProfile(
  id: string,
  overrides: Partial<LikeProfile> = {},
): LikeProfile | null {
  const profile = findMockPublicProfile(id);
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    photos: profile.photos,
    isVerified: profile.isVerified,
    gender: profile.gender,
    relationshipGoal: profile.relationshipGoal,
    isOnline: profile.isOnline,
    city: profile.city,
    country: profile.country,
    distanceKm: profile.distanceKm ?? null,
    ...overrides,
  };
}

function requireProfile(id: string, overrides?: Partial<LikeProfile>) {
  const profile = toLikeProfile(id, overrides);
  if (!profile) {
    throw new Error(`Unknown mock profile ${id}`);
  }
  return profile;
}

let likesSent: LikeSent[] = [
  {
    id: 'ls-hhhh',
    user: requireProfile('new-4'),
    likedAt: hoursAgo(3),
  },
  {
    id: 'ls-benz',
    user: requireProfile('new-1'),
    likedAt: hoursAgo(10),
  },
];

let likesReceived: LikeReceived[] = [
  {
    id: 'lr-layla',
    user: requireProfile('all-1'),
    isSuperlike: false,
    likedAt: hoursAgo(5),
  },
  {
    id: 'lr-martin',
    user: requireProfile('all-2'),
    isSuperlike: false,
    likedAt: hoursAgo(8),
  },
  {
    id: 'lr-john',
    user: requireProfile('all-3'),
    isSuperlike: true,
    likedAt: hoursAgo(12),
  },
  {
    id: 'lr-oliver',
    user: requireProfile('all-4'),
    isSuperlike: false,
    likedAt: hoursAgo(18),
  },
  {
    id: 'lr-rohan',
    user: requireProfile('all-5'),
    isSuperlike: false,
    likedAt: hoursAgo(22),
  },
  {
    id: 'lr-natt',
    user: requireProfile('new-3'),
    isSuperlike: false,
    likedAt: hoursAgo(30),
  },
];

let profileViews: ProfileView[] = [
  {
    id: 'pv-hhhh',
    user: requireProfile('new-4'),
    viewedAt: hoursAgo(1),
  },
  {
    id: 'pv-amara',
    user: requireProfile('new-2'),
    viewedAt: hoursAgo(8),
  },
];

function page<T>(items: T[]) {
  return { items, nextCursor: null };
}

export function hasMockLikedUser(targetUserId: string) {
  return likesSent.some(item => item.user.id === targetUserId);
}

export function listMockLikesSent() {
  return page(
    [...likesSent].sort(
      (left, right) =>
        new Date(right.likedAt).getTime() - new Date(left.likedAt).getTime(),
    ),
  );
}

export function listMockLikesReceived() {
  return page(
    [...likesReceived].sort(
      (left, right) =>
        new Date(right.likedAt).getTime() - new Date(left.likedAt).getTime(),
    ),
  );
}

export function listMockProfileViews() {
  return page(
    [...profileViews].sort(
      (left, right) =>
        new Date(right.viewedAt).getTime() - new Date(left.viewedAt).getTime(),
    ),
  );
}

export function listMockMatches(userId: string): { items: Match[]; nextCursor: null } {
  return page(
    listMockConversations(userId).map(conversation => ({
      id: conversation.matchId,
      conversationId: conversation.id,
      user:
        toLikeProfile(conversation.user.id) ?? {
          ...conversation.user,
          gender: null,
          relationshipGoal: null,
          isOnline: false,
          city: null,
          country: null,
          distanceKm: null,
        },
      matchedAt: conversation.updatedAt,
      isNew: conversation.lastMessage == null,
    })),
  );
}

export function recordMockLikeSent(targetUserId: string) {
  const user = toLikeProfile(targetUserId);
  if (!user || likesSent.some(item => item.user.id === user.id)) {
    return null;
  }
  likesSent.unshift({
    id: `ls-${user.id}`,
    user,
    likedAt: new Date().toISOString(),
  });

  const incoming = likesReceived.find(item => item.user.id === user.id);
  if (incoming) {
    return acceptMockLike(incoming.id);
  }
  return null;
}

export function removeMockLikeSent(targetUserId: string) {
  likesSent = likesSent.filter(item => item.user.id !== targetUserId);
}

export function recordMockProfileView(targetUserId: string) {
  const user = toLikeProfile(targetUserId);
  if (!user) {
    return;
  }
  profileViews = profileViews.filter(item => item.user.id !== user.id);
  profileViews.unshift({
    id: `pv-${user.id}`,
    user,
    viewedAt: new Date().toISOString(),
  });
}

export function acceptMockLike(likeId: string): LikeResponseResult {
  const incoming = likesReceived.find(item => item.id === likeId);
  if (!incoming) {
    return { match: null };
  }

  likesReceived = likesReceived.filter(item => item.id !== likeId);
  if (!likesSent.some(item => item.user.id === incoming.user.id)) {
    likesSent.unshift({
      id: `ls-${incoming.user.id}`,
      user: incoming.user,
      likedAt: new Date().toISOString(),
    });
  }

  const conversation = ensureMockConversation({
    userId: incoming.user.id,
    name: incoming.user.name,
    age: incoming.user.age,
    isVerified: incoming.user.isVerified,
    photoUrl: incoming.user.photos[0]?.url,
  });

  return {
    match: {
      id: conversation.matchId,
      conversationId: conversation.id,
      user:
        toLikeProfile(conversation.user.id) ?? {
          ...conversation.user,
          gender: null,
          relationshipGoal: null,
          isOnline: false,
          city: null,
          country: null,
          distanceKm: null,
        },
      matchedAt: conversation.updatedAt,
      isNew: true,
    },
  };
}

export function passMockLike(likeId: string) {
  likesReceived = likesReceived.filter(item => item.id !== likeId);
}

