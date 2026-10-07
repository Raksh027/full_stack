import type { Gender, SexualOrientation } from '@/features/profile/types';

export type DiscoveryAudience = {
  genders: Gender[] | null;
  orientations: SexualOrientation[] | null;
};

function canonGender(value?: string | null): string | null {
  const raw = (value || '').trim().toLowerCase().replace(/[\s-]/g, '');
  if (raw === 'man' || raw === 'men') {
    return 'man';
  }
  if (raw === 'woman' || raw === 'women') {
    return 'woman';
  }
  if (raw === 'nonbinary') {
    return 'nonbinary';
  }
  if (raw === 'transgender' || raw === 'trans' || raw === 'other') {
    return 'transgender';
  }
  return raw || null;
}

function canonOrientation(value?: string | null): string | null {
  return (value || '').trim().toLowerCase() || null;
}

export function discoveryAudienceFromProfile(
  gender?: string | null,
  orientation?: string | null,
): DiscoveryAudience {
  const genderKey = canonGender(gender);
  const orientationKey = canonOrientation(orientation);
  if (!orientationKey) {
    return { genders: null, orientations: null };
  }
  if (orientationKey === 'straight') {
    if (genderKey === 'man') {
      return { genders: ['woman'], orientations: null };
    }
    if (genderKey === 'woman') {
      return { genders: ['man'], orientations: null };
    }
    return { genders: ['man', 'woman'], orientations: null };
  }
  return {
    genders: null,
    orientations: [orientationKey as SexualOrientation],
  };
}

export function matchesDiscoveryAudience(
  card: { gender?: string | null; sexualOrientation?: string | null },
  audience: DiscoveryAudience,
): boolean {
  const cardGender = canonGender(card.gender);
  if (
    audience.genders &&
    cardGender &&
    !audience.genders.includes(cardGender as Gender)
  ) {
    return false;
  }
  const cardOrientation = canonOrientation(card.sexualOrientation);
  if (
    audience.orientations &&
    cardOrientation &&
    !audience.orientations.includes(cardOrientation as SexualOrientation)
  ) {
    return false;
  }
  return true;
}
