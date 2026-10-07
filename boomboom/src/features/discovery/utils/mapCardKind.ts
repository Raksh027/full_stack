import type { DiscoveryCandidate } from '../types';
import { asNullableNumber } from '@/shared/utils/safeValue';

export type MapCardKind = 'freeTonight' | 'crossedPaths' | 'nearby';

export const MAP_CARD_ACCENT: Record<
  MapCardKind,
  { ring: string; glow: string; pill: string; icon: string }
> = {
  freeTonight: {
    ring: '#C026FF',
    glow: 'rgba(192, 38, 255, 0.55)',
    pill: '#7C3AED',
    icon: 'moon',
  },
  crossedPaths: {
    ring: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.45)',
    pill: '#1E293B',
    icon: 'compass',
  },
  nearby: {
    ring: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.4)',
    pill: '#7F1D1D',
    icon: 'location',
  },
};

export function mapCardKindForProfile(
  profile: DiscoveryCandidate,
  index: number,
): MapCardKind {
  if (
    profile.mapKind === 'freeTonight' ||
    profile.mapKind === 'crossedPaths' ||
    profile.mapKind === 'nearby'
  ) {
    return profile.mapKind;
  }
  if (profile.isOnline) {
    return 'freeTonight';
  }
  if ((profile.distanceKm ?? 99) <= 2) {
    return 'crossedPaths';
  }
  const cycle: MapCardKind[] = ['nearby', 'crossedPaths', 'freeTonight'];
  return cycle[index % cycle.length];
}

export function formatMapDistance(km: number | null | undefined): string {
  const value = asNullableNumber(km);
  if (value == null) {
    return '—';
  }
  return `${value.toFixed(1)} km`;
}
