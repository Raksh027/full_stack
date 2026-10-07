import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, {
  type GeolocationError,
} from '@react-native-community/geolocation';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationErrorReason =
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown';

export class LocationError extends Error {
  constructor(readonly reason: LocationErrorReason) {
    super(`Location request failed: ${reason}`);
  }
}

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto',
});

function toLocationError(error: GeolocationError): LocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new LocationError('denied');
    case error.POSITION_UNAVAILABLE:
      return new LocationError('unavailable');
    case error.TIMEOUT:
      return new LocationError('timeout');
    default:
      return new LocationError('unknown');
  }
}

function requestIosAuthorization(): Promise<void> {
  return new Promise((resolve, reject) => {
    Geolocation.requestAuthorization(resolve, error =>
      reject(toLocationError(error)),
    );
  });
}

async function ensurePermission() {
  if (Platform.OS === 'android') {
    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (fine === PermissionsAndroid.RESULTS.GRANTED) {
      return;
    }
    const coarse = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
    if (coarse !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new LocationError('denied');
    }
    return;
  }
  await requestIosAuthorization();
}

function readPosition(options: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      error => reject(toLocationError(error)),
      options,
    );
  });
}

/** Asks for when-in-use permission, then returns GPS. Prefers a cached fix so maps open fast. */
export async function getDeviceLocation(): Promise<Coordinates> {
  try {
    await ensurePermission();
  } catch (error) {
    throw error instanceof LocationError
      ? error
      : new LocationError('denied');
  }
  const attempts = [
    { enableHighAccuracy: false, timeout: 4_000, maximumAge: 120_000 },
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 },
    { enableHighAccuracy: false, timeout: 6_000, maximumAge: 0 },
  ] as const;
  let lastError: unknown;
  for (const options of attempts) {
    try {
      return await readPosition(options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof LocationError
    ? lastError
    : new LocationError('unknown');
}

export function metersBetween(from: Coordinates, to: Coordinates) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(a)));
}
