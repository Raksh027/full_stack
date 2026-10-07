import type { Gender, Profile, RelationshipGoal } from '@/features/profile/types';
import type { ID, ISODateString } from '@/shared/types/api';

export type MatchUser = Pick<
  Profile,
  'id' | 'name' | 'age' | 'photos' | 'isVerified'
>;

export type LikeProfile = MatchUser & {
  gender: Gender | null;
  relationshipGoal: RelationshipGoal | null;
  isOnline: boolean;
  city: string | null;
  country: string | null;
  countryCode?: string | null;
  countryFlag?: string | null;
  distanceKm: number | null;
};

export type Match = {
  id: ID;
  conversationId: ID;
  user: LikeProfile;
  matchedAt: ISODateString;
  isNew: boolean;
};

export type LikeReceived = {
  id: ID;
  user: LikeProfile;
  isSuperlike: boolean;
  likedAt: ISODateString;
};

export type LikeSent = {
  id: ID;
  user: LikeProfile;
  likedAt: ISODateString;
};

export type ProfileView = {
  id: ID;
  user: LikeProfile;
  viewedAt: ISODateString;
};

export type LikeResponseRequest = {
  likeId: ID;
  action: 'like' | 'pass';
};

export type LikeResponseResult = {
  match: Match | null;
};
