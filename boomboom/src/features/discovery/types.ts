import type { Match, LikeProfile } from '@/features/matches/types';
import type { Profile } from '@/features/profile/types';
import type { ID } from '@/shared/types/api';

export type MapPersonKind = 'freeTonight' | 'crossedPaths' | 'nearby';

export type DiscoveryCandidate = Profile & {
  distanceKm: number | null;
  commonInterests: string[];
  isOnline: boolean;
  isNew: boolean;
  nationality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mapKind?: MapPersonKind | null;
};

export type SwipeAction = 'like' | 'pass' | 'superlike';

export type SwipeRequest = {
  targetUserId: ID;
  action: SwipeAction;
};

export type SwipeResult = {
  match: Match | null;
  user?: LikeProfile | null;
  likeId?: string | null;
  remainingLikes: number | null;
  remainingSuperlikes: number | null;
};
