import type { ID, ISODateString, Photo } from '@/shared/types/api';

export type Gender = 'man' | 'woman' | 'transgender' | 'nonbinary';

export type SexualOrientation =
  | 'straight'
  | 'gay'
  | 'lesbian'
  | 'bisexual'
  | 'pansexual'
  | 'queer'
  | 'asexual'
  | 'demisexual'
  | 'questioning';

export type RelationshipGoal =
  | 'serious_love'
  | 'marriage'
  | 'casual'
  | 'long_term'
  | 'short_term'
  | 'travel_partner'
  | 'new_friends'
  | 'mutual_support'
  | 'freelance';

export type Ethnicity =
  | 'asian'
  | 'black'
  | 'hispanic'
  | 'white'
  | 'mixed'
  | 'other';
export type BodyType =
  | 'slim'
  | 'athletic'
  | 'average'
  | 'curvy'
  | 'muscular'
  | 'plus_size';
export type HeightRange = 'short' | 'average' | 'tall';
export type EyeColor = 'brown' | 'blue' | 'green' | 'hazel' | 'gray' | 'other';
export type Smoking = 'non_smoker' | 'occasional' | 'regular' | 'social';
export type Drinking = 'non_drinker' | 'social' | 'regular' | 'occasional';
export type WorkoutFrequency =
  | 'never'
  | 'sometimes'
  | 'regular'
  | 'daily'
  | 'enthusiast';

export type Personality =
  | 'introvert'
  | 'extrovert'
  | 'ambivert'
  | 'caring'
  | 'romantic'
  | 'funny';

export type WorkCategory =
  | 'business_owner'
  | 'software_engineer'
  | 'doctor'
  | 'teacher'
  | 'lawyer'
  | 'student'
  | 'influencer'
  | 'marketing'
  | 'entrepreneur'
  | 'designer'
  | 'chartered_accountant'
  | 'other';

export type Lifestyle = {
  ethnicity: Ethnicity | null;
  bodyType: BodyType | null;
  heightRange: HeightRange | null;
  eyeColor: EyeColor | null;
  smoking: Smoking | null;
  drinking: Drinking | null;
  workout: WorkoutFrequency | null;
  personality: Personality | null;
};

export type Profile = {
  id: ID;
  name: string;
  age: number;
  gender: Gender | null;
  sexualOrientation: SexualOrientation | null;
  showOrientation: boolean;
  bio: string | null;
  photos: Photo[];
  interests: string[];
  languages: string[];
  workCategory: WorkCategory | null;
  relationshipGoal: RelationshipGoal | null;
  lifestyle: Lifestyle;
  jobTitle: string | null;
  company: string | null;
  school: string | null;
  heightCm: number | null;
  city: string | null;
  locality?: string | null;
  district?: string | null;
  region?: string | null;
  place?: string | null;
  country: string | null;
  countryCode?: string | null;
  countryFlag?: string | null;
  isVerified: boolean;
  liked?: boolean;
};

export type MyProfile = Profile & {
  birthDate: ISODateString | null;
  completeness: number;
};

export type UpdateProfileRequest = Partial<
  Pick<
    MyProfile,
    | 'name'
    | 'birthDate'
    | 'gender'
    | 'sexualOrientation'
    | 'showOrientation'
    | 'bio'
    | 'interests'
    | 'languages'
    | 'workCategory'
    | 'relationshipGoal'
    | 'jobTitle'
    | 'company'
    | 'school'
    | 'heightCm'
  >
> & { lifestyle?: Partial<Lifestyle> };

export type PhotoUploadTicket = {
  photoId: ID;
  uploadUrl: string;
  headers?: Record<string, string>;
  expiresAt: ISODateString;
};

export type UpdateLocationRequest = {
  latitude: number;
  longitude: number;
  locality?: string;
  city?: string;
  district?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  countryFlag?: string;
};

export type ResolvedLocation = {
  locality?: string | null;
  city: string | null;
  district?: string | null;
  region?: string | null;
  place?: string | null;
  country: string | null;
  countryCode?: string | null;
  countryFlag?: string | null;
};

export type EmailChangeStatus = {
  email: string;
  canChange: boolean;
  nextChangeAt: string | null;
  daysRemaining: number;
  cooldownDays: number;
};
