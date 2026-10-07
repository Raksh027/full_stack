import { useMemo } from 'react';

import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';
import { asArray } from '@/shared/utils/safeValue';

import {
  discoveryAudienceFromProfile,
  matchesDiscoveryAudience,
} from '../utils/discoveryAudience';
const EMPTY_ITEMS: never[] = [];

export function useDiscoveryAudience() {
  const { data: me } = useGetMyProfileQuery();
  return useMemo(
    () => discoveryAudienceFromProfile(me?.gender, me?.sexualOrientation),
    [me?.gender, me?.sexualOrientation],
  );
}

export function useAudienceFiltered<
  T extends { gender?: string | null; sexualOrientation?: string | null },
>(items?: T[] | null): T[] {
  const audience = useDiscoveryAudience();
  const list = asArray(items) as T[];
  return useMemo(() => {
    if (list.length === 0) {
      return EMPTY_ITEMS as T[];
    }
    return list.filter(item => matchesDiscoveryAudience(item, audience));
  }, [audience, list]);
}
