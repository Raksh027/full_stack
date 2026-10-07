export type PlaceSource = {
  place?: string | null;
  locality?: string | null;
  city?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
};

export function displayPlaceName(source: PlaceSource) {
  for (const value of [
    source.place,
    source.locality,
    source.city,
    source.district,
    source.region,
    source.country,
  ]) {
    const text = value?.trim();
    if (text) {
      return text;
    }
  }
  return '';
}
