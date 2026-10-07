import { env } from '@/config/env';

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type PlaceLocation = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type AutocompleteResponse = {
  status: string;
  predictions?: {
    place_id: string;
    description: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }[];
};

type DetailsResponse = {
  status: string;
  result?: {
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
};

export class PlacesUnavailableError extends Error {
  constructor(readonly status: string) {
    super(`Places request failed: ${status}`);
  }
}

type GeocodeResponse = {
  status: string;
  results?: {
    address_components?: {
      long_name: string;
      short_name: string;
      types: string[];
    }[];
  }[];
};

export type ReverseGeocodedPlace = {
  locality?: string;
  city?: string;
  district?: string;
  region?: string;
  country?: string;
  countryCode?: string;
};

let sessionToken = createSessionToken();

function createSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapsKey() {
  return env.GOOGLE_MAPS_API_KEY ?? '';
}

function resetSession() {
  sessionToken = createSessionToken();
}

export async function autocompletePlaces(
  query: string,
  bias?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  const key = mapsKey();
  const input = query.trim();
  if (!key || input.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    input,
    key,
    sessiontoken: sessionToken,
    language: 'en',
  });
  if (bias) {
    params.set('location', `${bias.latitude},${bias.longitude}`);
    params.set('radius', '40000');
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
  );
  const json = (await response.json()) as AutocompleteResponse;
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new PlacesUnavailableError(json.status);
  }

  return (json.predictions ?? []).slice(0, 6).map(item => ({
    placeId: item.place_id,
    primaryText: item.structured_formatting?.main_text ?? item.description,
    secondaryText: item.structured_formatting?.secondary_text ?? '',
  }));
}

export type CountrySuggestion = {
  placeId: string;
  name: string;
  countryCode?: string;
};

export async function autocompleteCountries(
  query: string,
): Promise<CountrySuggestion[]> {
  const key = mapsKey();
  const input = query.trim();
  if (!key || input.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    input,
    key,
    sessiontoken: sessionToken,
    language: 'en',
    types: 'country',
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
  );
  const json = (await response.json()) as AutocompleteResponse;
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new PlacesUnavailableError(json.status);
  }

  return (json.predictions ?? []).slice(0, 12).map(item => ({
    placeId: item.place_id,
    name: item.structured_formatting?.main_text ?? item.description,
  }));
}

export async function getCountryFromPlace(
  placeId: string,
): Promise<{ name: string; countryCode?: string } | null> {
  const key = mapsKey();
  if (!key) {
    return null;
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key,
    sessiontoken: sessionToken,
    fields: 'name,address_component',
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
  );
  const json = (await response.json()) as {
    status: string;
    result?: {
      name?: string;
      address_components?: {
        long_name: string;
        short_name: string;
        types: string[];
      }[];
    };
  };
  resetSession();
  if (json.status !== 'OK' || !json.result) {
    return null;
  }
  const country = json.result.address_components?.find(item =>
    item.types.includes('country'),
  );
  const code = country?.short_name?.trim().toLowerCase();
  return {
    name: country?.long_name ?? json.result.name ?? '',
    countryCode: code && code.length === 2 ? code : undefined,
  };
}

export async function getPlaceLocation(
  placeId: string,
): Promise<PlaceLocation | null> {
  const key = mapsKey();
  if (!key) {
    return null;
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key,
    sessiontoken: sessionToken,
    fields: 'geometry,name,formatted_address',
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
  );
  const json = (await response.json()) as DetailsResponse;
  resetSession();

  const location = json.result?.geometry?.location;
  if (json.status !== 'OK' || location == null) {
    return null;
  }

  return {
    placeId,
    name: json.result?.name ?? '',
    address: json.result?.formatted_address ?? '',
    latitude: location.lat,
    longitude: location.lng,
  };
}

function firstComponent(
  components: NonNullable<GeocodeResponse['results']>[number]['address_components'],
  type: string,
) {
  return components?.find(item => item.types.includes(type));
}

function firstNamed(
  results: GeocodeResponse['results'],
  types: string[],
) {
  for (const type of types) {
    for (const result of results ?? []) {
      const item = firstComponent(result.address_components, type);
      const name = item?.long_name?.trim();
      if (name) {
        return item;
      }
    }
  }
  return undefined;
}

export async function reverseGeocodePlace(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodedPlace> {
  const key = mapsKey();
  if (!key) {
    return {};
  }

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key,
    language: 'en',
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
  );
  const json = (await response.json()) as GeocodeResponse;
  if (json.status !== 'OK') {
    return {};
  }

  const results = json.results ?? [];
  const block = firstNamed(results, [
    'neighborhood',
    'sublocality_level_1',
    'sublocality',
    'sublocality_level_2',
    'sublocality_level_3',
  ]);
  const city = firstNamed(results, ['locality', 'postal_town']);
  const district = firstNamed(results, [
    'administrative_area_level_3',
    'administrative_area_level_2',
  ]);
  const region = firstNamed(results, ['administrative_area_level_1']);
  const country = firstNamed(results, ['country']);
  const countryCode = country?.short_name?.trim().toLowerCase();
  const districtName = district?.long_name;
  const cityName = city?.long_name;

  return {
    locality: block?.long_name,
    city: cityName,
    district:
      districtName && districtName !== cityName && districtName !== block?.long_name
        ? districtName
        : undefined,
    region: region?.long_name,
    country: country?.long_name,
    countryCode:
      countryCode && countryCode.length === 2 ? countryCode : undefined,
  };
}

export async function reverseGeocodeCity(
  latitude: number,
  longitude: number,
): Promise<string | undefined> {
  const place = await reverseGeocodePlace(latitude, longitude);
  return place.city;
}
