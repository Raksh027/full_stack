import { countryCodeForName } from '@/features/discovery/data/geoHierarchy';
import { flagUrl } from '@/features/discovery/data/journeyLocations';

export type ProfileFlagSource = {
  countryFlag?: string | null;
  countryCode?: string | null;
  country?: string | null;
};

export function profileFlagCode(source: ProfileFlagSource) {
  const stored = source.countryCode?.trim().toLowerCase();
  if (stored && stored.length === 2) {
    return stored;
  }
  const mapped = countryCodeForName(source.country);
  return mapped || undefined;
}

export function profileFlagUrl(source: ProfileFlagSource) {
  if (source.countryFlag) {
    return source.countryFlag;
  }
  const code = profileFlagCode(source);
  return code ? flagUrl(code) : undefined;
}
