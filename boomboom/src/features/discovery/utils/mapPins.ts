import type { DiscoveryCandidate } from '../types';

export const NEARBY_RADII_KM = [2, 5, 10, 25, 50] as const;

export type MapCoord = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoord & {
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Connaught Place, New Delhi — default camera when GPS is unavailable. */
export const MAP_CENTER = { lat: 28.6328, lng: 77.2197 };
export const DEFAULT_MAP_COORD: MapCoord = {
  latitude: MAP_CENTER.lat,
  longitude: MAP_CENTER.lng,
};

/** Seeded people live around these Delhi spots — search here to see pins. */
export const MAP_PEOPLE_HOTSPOTS: Array<MapCoord & { name: string }> = [
  { name: 'Connaught Place', latitude: 28.6304, longitude: 77.2177 },
  { name: 'Hauz Khas', latitude: 28.5494, longitude: 77.2001 },
  { name: 'Khan Market', latitude: 28.6002, longitude: 77.227 },
  { name: 'Gurugram', latitude: 28.495, longitude: 77.089 },
];
export const MAP_ZOOM = 14;
export const MAP_COLS = 3;
export const MAP_ROWS = 5;

export type MapPinLayout = {
  id: string;
  left: number;
  top: number;
};

export type MapTile = {
  key: string;
  url: string;
  col: number;
  row: number;
};

function hashId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 33 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function lonToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    2 ** zoom
  );
}

const originX = Math.floor(lonToTileX(MAP_CENTER.lng, MAP_ZOOM)) - 1;
const originY = Math.floor(latToTileY(MAP_CENTER.lat, MAP_ZOOM)) - 2;

export function getMapTiles(): MapTile[] {
  const tiles: MapTile[] = [];
  const hosts = ['a', 'b', 'c', 'd'] as const;
  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let col = 0; col < MAP_COLS; col += 1) {
      const x = originX + col;
      const y = originY + row;
      const host = hosts[(x + y) % hosts.length]!;
      tiles.push({
        key: `${x}-${y}`,
        col,
        row,
        url: `https://${host}.basemaps.cartocdn.com/dark_all/${MAP_ZOOM}/${x}/${y}@2x.png`,
      });
    }
  }
  return tiles;
}

export function projectToMap(lat: number, lng: number) {
  const left = (lonToTileX(lng, MAP_ZOOM) - originX) / MAP_COLS;
  const top = (latToTileY(lat, MAP_ZOOM) - originY) / MAP_ROWS;
  return {
    left: Math.min(0.9, Math.max(0.08, left)),
    top: Math.min(0.82, Math.max(0.12, top)),
  };
}

export const YOU_POSITION = projectToMap(MAP_CENTER.lat, MAP_CENTER.lng);

function offsetFromPoint(
  center: MapCoord,
  distanceKm: number,
  bearingRad: number,
): MapCoord {
  const latRad = (center.latitude * Math.PI) / 180;
  const dLat = (distanceKm * Math.cos(bearingRad)) / 111.32;
  const dLng =
    (distanceKm * Math.sin(bearingRad)) / (111.32 * Math.cos(latRad));
  return {
    latitude: center.latitude + dLat,
    longitude: center.longitude + dLng,
  };
}

function offsetFromCenter(distanceKm: number, bearingRad: number) {
  const point = offsetFromPoint(DEFAULT_MAP_COORD, distanceKm, bearingRad);
  return { lat: point.latitude, lng: point.longitude };
}

export function coordinateForPerson(
  person: DiscoveryCandidate,
  center: MapCoord,
): MapCoord {
  if (
    person.latitude != null &&
    person.longitude != null &&
    Number.isFinite(person.latitude) &&
    Number.isFinite(person.longitude)
  ) {
    return { latitude: person.latitude, longitude: person.longitude };
  }
  const hash = hashId(person.id);
  const angle = ((hash % 360) * Math.PI) / 180;
  return offsetFromPoint(center, person.distanceKm ?? 4, angle);
}

export function regionFromRadius(
  center: MapCoord,
  radiusKm: number,
): MapRegion {
  const latitudeDelta = Math.max((radiusKm * 2.4) / 111, 0.018);
  const longitudeDelta =
    latitudeDelta / Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.2);
  return {
    ...center,
    latitudeDelta,
    longitudeDelta,
  };
}

/** Tight camera around a pin, shifted so the card below does not cover it. */
export function regionForPin(coord: MapCoord): MapRegion {
  const latitudeDelta = 0.016;
  return {
    latitude: coord.latitude - latitudeDelta * 0.22,
    longitude: coord.longitude,
    latitudeDelta,
    longitudeDelta: 0.016,
  };
}

/** Places people on the Delhi map from their distance, around Connaught Place. */
export function layoutMapPins(people: DiscoveryCandidate[]): MapPinLayout[] {
  return people.map(person => {
    const hash = hashId(person.id);
    const angle = ((hash % 360) * Math.PI) / 180;
    const point = offsetFromCenter(person.distanceKm ?? 4, angle);
    return { id: person.id, ...projectToMap(point.lat, point.lng) };
  });
}

export function radiusRingSize(radiusKm: number, tileSize: number) {
  const metersPerPixel =
    (156543.03392 * Math.cos((MAP_CENTER.lat * Math.PI) / 180)) /
    2 ** MAP_ZOOM;
  return (radiusKm * 1000 * tileSize) / (metersPerPixel * 256);
}
