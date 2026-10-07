import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useUpdateLocationMutation } from '@/features/profile/api/profileApi';
import type { MyProfile } from '@/features/profile/types';
import {
  getDeviceLocation,
  type Coordinates,
} from '@/services/location/deviceLocation';
import { reverseGeocodePlace } from '@/services/maps/googlePlaces';
import { displayPlaceName } from '@/shared/utils/placeName';
import { profileFlagUrl } from '@/shared/utils/profileFlag';

export type HomeLocationStatus =
  | 'idle'
  | 'fetching'
  | 'refreshing'
  | 'done'
  | 'error';

type SyncOptions = {
  force?: boolean;
  manual?: boolean;
};

type SyncFn = (options?: SyncOptions) => Promise<void>;

const MOVE_METERS = 200;
const EARTH_RADIUS_M = 6_371_000;

type Listener = (status: HomeLocationStatus) => void;

const listeners = new Set<Listener>();
const coordListeners = new Set<() => void>();
let currentStatus: HomeLocationStatus = 'idle';
let lastUserId: string | null = null;
let lastCoords: Coordinates | null = null;
let lastPlace = '';
let inFlight: Promise<void> | null = null;
let runSync: SyncFn | null = null;

function publish(status: HomeLocationStatus) {
  currentStatus = status;
  listeners.forEach(listener => listener(status));
}

function metersBetween(from: Coordinates, to: Coordinates) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function rememberCoords(coords: Coordinates, place?: string) {
  const sameSpot =
    lastCoords != null && metersBetween(lastCoords, coords) < 25;
  lastCoords = coords;
  if (place) {
    lastPlace = place;
  }
  if (!sameSpot) {
    coordListeners.forEach(listener => listener());
  }
}

export function getLastKnownCoords(): Coordinates | null {
  return lastCoords;
}

export function useLastKnownCoords(): Coordinates | null {
  const [coords, setCoords] = useState(lastCoords);
  useEffect(() => {
    const onChange = () => setCoords(lastCoords);
    coordListeners.add(onChange);
    onChange();
    return () => {
      coordListeners.delete(onChange);
    };
  }, []);
  return coords;
}

export function useLocationSyncStatus() {
  const [status, setStatus] = useState(currentStatus);
  useEffect(() => {
    listeners.add(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  return status;
}

export function noteDeviceCoords(coords: Coordinates) {
  if (
    !Number.isFinite(coords.latitude) ||
    !Number.isFinite(coords.longitude) ||
    (Math.abs(coords.latitude) < 0.01 && Math.abs(coords.longitude) < 0.01)
  ) {
    return;
  }
  rememberCoords(coords);
}

export async function refreshCurrentLocation() {
  const started = Date.now();
  while (!runSync && Date.now() - started < 4_000) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!runSync) {
    throw new Error('location');
  }
  await runSync({ force: true, manual: true });
  if (currentStatus === 'error') {
    throw new Error('location');
  }
  return lastPlace;
}

export function useHomeLocation(me?: MyProfile) {
  const [updateLocation] = useUpdateLocationMutation();
  const status = useLocationSyncStatus();

  useEffect(() => {
    if (!me?.id) {
      runSync = null;
      return;
    }

    const sync: SyncFn = async (options = {}) => {
      if (inFlight) {
        await inFlight;
        if (!options.force) {
          return;
        }
      }

      const hasPlace = Boolean(displayPlaceName(me) || lastPlace);
      publish(options.manual || !hasPlace ? 'fetching' : 'refreshing');

      inFlight = (async () => {
        try {
          const previous = lastCoords;
          const previousPlace = lastPlace;
          const coords = await getDeviceLocation();
          rememberCoords(coords);
          lastUserId = me.id;
          let place;
          try {
            place = await reverseGeocodePlace(
              coords.latitude,
              coords.longitude,
            );
          } catch {
            place = null;
          }
          const nextPlace = displayPlaceName({
            locality: place?.locality,
            city: place?.city,
            district: place?.district,
            region: place?.region,
            country: place?.country,
          });
          if (nextPlace) {
            rememberCoords(coords, nextPlace);
          }
          const moved =
            !previous || metersBetween(previous, coords) >= MOVE_METERS;
          const placeChanged = Boolean(nextPlace) && nextPlace !== previousPlace;
          const sameUser = lastUserId === me.id;
          if (!options.force && sameUser && !moved && !placeChanged) {
            publish('done');
            return;
          }

          const countryCode = place?.countryCode;
          const countryFlag = profileFlagUrl({
            countryCode,
            country: place?.country,
          });
          try {
            await updateLocation({
              latitude: coords.latitude,
              longitude: coords.longitude,
              locality: place?.locality,
              city: place?.city,
              district: place?.district,
              region: place?.region,
              country: place?.country,
              countryCode,
              countryFlag,
            }).unwrap();
          } catch {
            // Device coords still apply on the map/home header.
          }
          publish('done');
        } catch {
          lastUserId = me.id;
          publish(options.manual ? 'error' : lastCoords ? 'done' : 'error');
        } finally {
          inFlight = null;
        }
      })();

      await inFlight;
    };

    runSync = sync;
    void sync();

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void sync();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      if (runSync === sync) {
        runSync = null;
      }
    };
  }, [me?.id, updateLocation]);

  return status;
}
