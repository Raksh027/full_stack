import type { IconName } from '@/shared/components';

import type {
  BodyType,
  Drinking,
  Ethnicity,
  EyeColor,
  Gender,
  HeightRange,
  Lifestyle,
  RelationshipGoal,
  SexualOrientation,
  Personality,
  Smoking,
  WorkCategory,
  WorkoutFrequency,
} from '../types';

export type Option<T extends string> = {
  value: T;
  emoji?: string;
  icon?: IconName;
};

export const GENDER_OPTIONS: readonly Option<Gender>[] = [
  { value: 'man' },
  { value: 'woman' },
  { value: 'transgender' },
  { value: 'nonbinary' },
];

export const ORIENTATION_OPTIONS: readonly Option<SexualOrientation>[] = [
  { value: 'straight' },
  { value: 'gay' },
  { value: 'lesbian' },
  { value: 'bisexual' },
  { value: 'pansexual' },
  { value: 'queer' },
  { value: 'asexual' },
  { value: 'demisexual' },
  { value: 'questioning' },
];

export const RELATIONSHIP_GOAL_OPTIONS: readonly Option<RelationshipGoal>[] = [
  { value: 'serious_love', icon: 'heart' },
  { value: 'marriage', icon: 'diamond' },
  { value: 'casual', icon: 'happy' },
  { value: 'long_term', icon: 'sparkles' },
  { value: 'short_term', icon: 'time' },
  { value: 'travel_partner', icon: 'airplane' },
  { value: 'new_friends', icon: 'people' },
  { value: 'mutual_support', icon: 'heart-circle' },
  { value: 'freelance', icon: 'woman-outline' },
];

export const INTEREST_OPTIONS = [
  { value: 'music', icon: 'musical-notes-outline' },
  { value: 'travel', icon: 'airplane-outline' },
  { value: 'photography', icon: 'camera-outline' },
  { value: 'fitness', icon: 'fitness-outline' },
  { value: 'movies', icon: 'film-outline' },
  { value: 'party', icon: 'sparkles-outline' },
  { value: 'sports', icon: 'football-outline' },
  { value: 'gaming', icon: 'game-controller-outline' },
  { value: 'yoga', icon: 'leaf-outline' },
  { value: 'hiking', icon: 'trail-sign-outline' },
  { value: 'dancing', icon: 'musical-note-outline' },
] as const satisfies readonly Option<string>[];

export type Interest = (typeof INTEREST_OPTIONS)[number]['value'];

export const LANGUAGE_OPTIONS = [
  { value: 'english', emoji: '🇬🇧' },
  { value: 'hindi', emoji: '🇮🇳' },
  { value: 'thai', emoji: '🇹🇭' },
  { value: 'spanish', emoji: '🇪🇸' },
  { value: 'french', emoji: '🇫🇷' },
  { value: 'chinese', emoji: '🇨🇳' },
  { value: 'arabic', emoji: '🇸🇦' },
  { value: 'russian', emoji: '🇷🇺' },
  { value: 'malay', emoji: '🇲🇾' },
  { value: 'hangul', emoji: '🇰🇷' },
  { value: 'uzbek', emoji: '🇺🇿' },
  { value: 'turkish', emoji: '🇹🇷' },
] as const satisfies readonly Option<string>[];

export type SpokenLanguage = (typeof LANGUAGE_OPTIONS)[number]['value'];

export const WORK_OPTIONS = [
  { value: 'business_owner', icon: 'briefcase-outline' },
  { value: 'software_engineer', icon: 'laptop-outline' },
  { value: 'doctor', icon: 'medkit-outline' },
  { value: 'teacher', icon: 'school-outline' },
  { value: 'lawyer', icon: 'scale-outline' },
  { value: 'student', icon: 'book-outline' },
  { value: 'influencer', icon: 'megaphone-outline' },
  { value: 'marketing', icon: 'trending-up-outline' },
  { value: 'entrepreneur', icon: 'rocket-outline' },
  { value: 'designer', icon: 'color-palette-outline' },
  { value: 'chartered_accountant', icon: 'calculator-outline' },
  { value: 'other', icon: 'ellipsis-horizontal-outline' },
] as const satisfies readonly Option<WorkCategory>[];

export type WorkCategoryOption = (typeof WORK_OPTIONS)[number]['value'];

type LifestyleOptions = {
  [K in keyof Lifestyle]: readonly Option<NonNullable<Lifestyle[K]>>[];
};

export const LIFESTYLE_OPTIONS: LifestyleOptions = {
  ethnicity: [
    { value: 'asian', emoji: '🌏' },
    { value: 'black', emoji: '🌍' },
    { value: 'hispanic', emoji: '🌎' },
    { value: 'white', emoji: '🌐' },
    { value: 'mixed', emoji: '🌈' },
    { value: 'other', emoji: '🔄' },
  ] satisfies Option<Ethnicity>[],
  bodyType: [
    { value: 'slim', icon: 'walk-outline' },
    { value: 'athletic', icon: 'barbell-outline' },
    { value: 'average', icon: 'person-outline' },
    { value: 'curvy', icon: 'body-outline' },
    { value: 'muscular', icon: 'fitness-outline' },
    { value: 'plus_size', icon: 'sparkles-outline' },
  ] satisfies Option<BodyType>[],
  heightRange: [
    { value: 'short', emoji: '📏' },
    { value: 'average', emoji: '📐' },
    { value: 'tall', emoji: '📊' },
  ] satisfies Option<HeightRange>[],
  eyeColor: [
    { value: 'brown', emoji: '🤎' },
    { value: 'blue', emoji: '💙' },
    { value: 'green', emoji: '💚' },
    { value: 'hazel', emoji: '🟤' },
    { value: 'gray', emoji: '🩶' },
    { value: 'other', emoji: '👁️' },
  ] satisfies Option<EyeColor>[],
  smoking: [
    { value: 'non_smoker', emoji: '🚭' },
    { value: 'occasional', emoji: '🌬️' },
    { value: 'regular', emoji: '🚬' },
    { value: 'social', emoji: '👥' },
  ] satisfies Option<Smoking>[],
  drinking: [
    { value: 'non_drinker', icon: 'ban-outline' },
    { value: 'social', icon: 'people-outline' },
    { value: 'regular', icon: 'wine' },
    { value: 'occasional', icon: 'wine-outline' },
  ] satisfies Option<Drinking>[],
  workout: [
    { value: 'never', icon: 'bed-outline' },
    { value: 'sometimes', icon: 'walk-outline' },
    { value: 'regular', icon: 'bicycle-outline' },
    { value: 'daily', icon: 'fitness-outline' },
    { value: 'enthusiast', icon: 'flame-outline' },
  ] satisfies Option<WorkoutFrequency>[],
  personality: [
    { value: 'introvert', icon: 'moon-outline' },
    { value: 'extrovert', icon: 'sunny-outline' },
    { value: 'ambivert', icon: 'swap-horizontal-outline' },
    { value: 'caring', icon: 'heart-outline' },
    { value: 'romantic', icon: 'rose-outline' },
    { value: 'funny', icon: 'happy-outline' },
  ] satisfies Option<Personality>[],
};

export const LIFESTYLE_CATEGORIES = Object.keys(
  LIFESTYLE_OPTIONS,
) as (keyof Lifestyle)[];

export type LifestyleLabelKey = {
  [K in keyof Lifestyle]: `profileOptions.lifestyle.${K}.options.${NonNullable<
    Lifestyle[K]
  >}`;
}[keyof Lifestyle];

export function lifestyleLabelKey<K extends keyof Lifestyle>(
  category: K,
  value: NonNullable<Lifestyle[K]>,
): LifestyleLabelKey {
  return `profileOptions.lifestyle.${category}.options.${value}` as LifestyleLabelKey;
}

export const DISTANCE_OPTIONS_KM = Array.from({ length: 20 }, (_, i) => i + 1);
