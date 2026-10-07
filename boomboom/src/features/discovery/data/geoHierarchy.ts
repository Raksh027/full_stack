import {
  JOURNEY_CITIES,
  JOURNEY_COUNTRIES,
  type JourneyCountry,
} from './journeyLocations';

const GEO_BASE = 'https://countriesnow.space/api/v0.1';

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'USA',
  us: 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  uk: 'UK',
  'united kingdom': 'UK',
  'great britain': 'UK',
  uae: 'UAE',
  'united arab emirates': 'UAE',
};

const FALLBACK_CITY_KEYS: Record<string, string> = {
  'United States': 'USA',
  'United Kingdom': 'UK',
  'United Arab Emirates': 'UAE',
};

type IsoRow = {
  name?: string;
  Iso2?: string;
  iso2?: string;
};

type CountriesResponse = {
  error?: boolean;
  data?: IsoRow[];
};

type StatesResponse = {
  error?: boolean;
  data?: { states?: { name?: string }[] };
};

type CitiesResponse = {
  error?: boolean;
  data?: string[];
};

let countriesCache: JourneyCountry[] | null = null;
const statesCache = new Map<string, string[]>();
const citiesCache = new Map<string, string[]>();

export function resolveCountryName(name: string) {
  const trimmed = name.trim();
  return COUNTRY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function countryCodeForName(name: string | null | undefined) {
  if (!name) {
    return '';
  }
  const resolved = resolveCountryName(name);
  const list = countriesCache ?? JOURNEY_COUNTRIES;
  const match = list.find(
    item =>
      item.name.toLowerCase() === resolved.toLowerCase() ||
      item.name.toLowerCase() === name.trim().toLowerCase(),
  );
  return match?.code ?? '';
}

function uniqueSorted(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const name = value.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function fallbackCities(country: string) {
  const resolved = resolveCountryName(country);
  return (
    JOURNEY_CITIES[country] ??
    JOURNEY_CITIES[resolved] ??
    JOURNEY_CITIES[FALLBACK_CITY_KEYS[resolved] ?? ''] ??
    []
  );
}

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${GEO_BASE}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`geo ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJourneyCountries(): Promise<JourneyCountry[]> {
  if (countriesCache) {
    return countriesCache;
  }
  try {
    const payload = await getJson<CountriesResponse>('/countries/iso');
    const rows = payload.error ? [] : payload.data ?? [];
    const seen = new Set<string>();
    const list: JourneyCountry[] = [];
    for (const row of rows) {
      const name = (row.name || '').trim();
      const code = (row.Iso2 || row.iso2 || '').trim().toLowerCase();
      if (!name || !code || seen.has(code)) {
        continue;
      }
      seen.add(code);
      list.push({ name, code });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    countriesCache = list.length ? list : JOURNEY_COUNTRIES;
  } catch {
    countriesCache = JOURNEY_COUNTRIES;
  }
  return countriesCache;
}

export async function fetchJourneyStates(country: string): Promise<string[]> {
  const resolved = resolveCountryName(country);
  const cached = statesCache.get(resolved);
  if (cached) {
    return cached;
  }
  try {
    const query = encodeURIComponent(resolved);
    const payload = await getJson<StatesResponse>(
      `/countries/states/q?country=${query}`,
    );
    const names = (payload.data?.states ?? [])
      .map(item => item.name || '')
      .filter(Boolean);
    const list = uniqueSorted(names);
    statesCache.set(resolved, list);
    return list;
  } catch {
    const list: string[] = [];
    statesCache.set(resolved, list);
    return list;
  }
}

export async function fetchJourneyCities(
  country: string,
  state?: string | null,
): Promise<string[]> {
  const resolved = resolveCountryName(country);
  const region = state?.trim() ?? '';
  const cacheKey = `${resolved}::${region}`;
  const cached = citiesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const countryQuery = encodeURIComponent(resolved);
    const path = region
      ? `/countries/state/cities/q?country=${countryQuery}&state=${encodeURIComponent(region)}`
      : `/countries/cities/q?country=${countryQuery}`;
    const payload = await getJson<CitiesResponse>(path);
    const list = uniqueSorted(payload.error ? [] : payload.data ?? []);
    const resolvedList = list.length ? list : fallbackCities(resolved);
    citiesCache.set(cacheKey, resolvedList);
    return resolvedList;
  } catch {
    const list = fallbackCities(resolved);
    citiesCache.set(cacheKey, list);
    return list;
  }
}
