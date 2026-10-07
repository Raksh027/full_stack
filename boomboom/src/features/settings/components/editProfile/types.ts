export type EditProfileTab =
  | 'personal'
  | 'lifestyle'
  | 'lookingFor'
  | 'orientation'
  | 'photos'
  | 'gender';

export const EDIT_PROFILE_TABS: readonly EditProfileTab[] = [
  'personal',
  'lifestyle',
  'lookingFor',
  'orientation',
  'photos',
  'gender',
] as const;
