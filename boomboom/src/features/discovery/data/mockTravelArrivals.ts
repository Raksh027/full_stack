import type { IconName } from '@/shared/components';

import { countryCodeForName } from './geoHierarchy';
import { flagUrl } from './journeyLocations';

export type TravelTripType =
  | 'business'
  | 'vacation'
  | 'nightlife'
  | 'solo'
  | 'companion'
  | 'tourGuide'
  | 'massageSpa';

export type TravelInterestTag = {
  id: string;
  labelKey:
    | 'travel.tagTravelBuddy'
    | 'travel.tagShortTerm'
    | 'travel.tagCasual'
    | 'travel.tagBusiness'
    | 'travel.tagNightlife'
    | 'travel.tagSolo';
  icon: IconName;
  tone: 'pink' | 'blue' | 'navy';
};

export type TravelArrival = {
  id: string;
  userId?: string;
  name: string;
  age: number;
  photo: string;
  coverPhoto: string;
  flag: string;
  flagCode: string;
  flagUrl?: string;
  nationality: string;
  from: string;
  to: string;
  fromCity: string;
  fromCountry: string;
  fromCountryCode?: string;
  fromCountryFlag?: string;
  toCity: string;
  toCountry: string;
  toFlagCode: string;
  toCountryFlag?: string;
  status: string;
  tripType: TravelTripType;
  city: string;
  country: string;
  heightLabel: string;
  zodiac: string;
  tags: TravelInterestTag[];
  arrivalDate: string;
  returnDate?: string;
  purpose: string;
  travelStyle: string;
  companion?: string | null;
  hideFromCountry?: boolean;
  hideFrom?: string | null;
  quote: string;
  isOnline: boolean;
  gender?: string | null;
  sexualOrientation?: string | null;
  isVerified?: boolean;
  showStatus?: boolean;
  liked?: boolean;
};

export type TravelCountrySummary = {
  id: string;
  country: string;
  flag: string;
  flagCode: string;
  flagUrl?: string;
  arriving: number;
  extra: number;
  city: string;
  accent: string;
};

export const TRAVEL_TRIP_META: Record<
  TravelTripType,
  {
    labelKey:
      | 'travel.tripBusiness'
      | 'travel.tripVacation'
      | 'travel.tripNightlife'
      | 'travel.tripSolo'
      | 'travel.tripCompanion'
      | 'travel.tripTourGuide'
      | 'travel.tripMassageSpa';
    color: string;
    icon: IconName;
  }
> = {
  business: {
    labelKey: 'travel.tripBusiness',
    color: '#38BDF8',
    icon: 'briefcase',
  },
  vacation: {
    labelKey: 'travel.tripVacation',
    color: '#22C55E',
    icon: 'sunny',
  },
  nightlife: {
    labelKey: 'travel.tripNightlife',
    color: '#A855F7',
    icon: 'wine',
  },
  solo: {
    labelKey: 'travel.tripSolo',
    color: '#B45309',
    icon: 'person',
  },
  companion: {
    labelKey: 'travel.tripCompanion',
    color: '#EC4899',
    icon: 'people',
  },
  tourGuide: {
    labelKey: 'travel.tripTourGuide',
    color: '#14B8A6',
    icon: 'map',
  },
  massageSpa: {
    labelKey: 'travel.tripMassageSpa',
    color: '#8B5CF6',
    icon: 'leaf',
  },
};

export type TravelStyleType = 'solo' | 'group' | 'backpacker' | 'couple';
export type TravelCompanionType = 'any' | 'male' | 'female';

export const JOURNEY_TYPE_OPTIONS: Array<{
  id: TravelTripType;
  labelKey: (typeof TRAVEL_TRIP_META)[TravelTripType]['labelKey'] | 'travel.nightlifeParty';
}> = [
  { id: 'vacation', labelKey: 'travel.tripVacation' },
  { id: 'business', labelKey: 'travel.tripBusiness' },
  { id: 'nightlife', labelKey: 'travel.nightlifeParty' },
  { id: 'companion', labelKey: 'travel.tripCompanion' },
  { id: 'tourGuide', labelKey: 'travel.tripTourGuide' },
  { id: 'massageSpa', labelKey: 'travel.tripMassageSpa' },
];

export const TRAVEL_STYLE_OPTIONS: Array<{
  id: TravelStyleType;
  labelKey:
    | 'travel.styleSolo'
    | 'travel.styleGroup'
    | 'travel.styleBackpacker'
    | 'travel.styleCouple';
}> = [
  { id: 'solo', labelKey: 'travel.styleSolo' },
  { id: 'group', labelKey: 'travel.styleGroup' },
  { id: 'backpacker', labelKey: 'travel.styleBackpacker' },
  { id: 'couple', labelKey: 'travel.styleCouple' },
];

export const TRAVEL_GENDER_OPTIONS: Array<{
  id: TravelCompanionType;
  labelKey:
    | 'travel.companionAny'
    | 'travel.companionMale'
    | 'travel.companionFemale';
}> = [
  { id: 'any', labelKey: 'travel.companionAny' },
  { id: 'male', labelKey: 'travel.companionMale' },
  { id: 'female', labelKey: 'travel.companionFemale' },
];

const TAG_TRAVEL_BUDDY: TravelInterestTag = {
  id: 'travel-buddy',
  labelKey: 'travel.tagTravelBuddy',
  icon: 'airplane',
  tone: 'pink',
};

const TAG_SHORT_TERM: TravelInterestTag = {
  id: 'short-term',
  labelKey: 'travel.tagShortTerm',
  icon: 'sunny-outline',
  tone: 'blue',
};

const TAG_CASUAL: TravelInterestTag = {
  id: 'casual',
  labelKey: 'travel.tagCasual',
  icon: 'heart-outline',
  tone: 'navy',
};

const TAG_BUSINESS: TravelInterestTag = {
  id: 'business',
  labelKey: 'travel.tagBusiness',
  icon: 'briefcase-outline',
  tone: 'blue',
};

const TAG_NIGHTLIFE: TravelInterestTag = {
  id: 'nightlife',
  labelKey: 'travel.tagNightlife',
  icon: 'wine-outline',
  tone: 'pink',
};

const TAG_SOLO: TravelInterestTag = {
  id: 'solo',
  labelKey: 'travel.tagSolo',
  icon: 'person-outline',
  tone: 'navy',
};

const COVER_BEACH =
  'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=80';
const COVER_CLIFF =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';

const COUNTRY_CARD_SEED: Array<
  [country: string, flag: string, flagCode: string, city: string]
> = [
  ['France', '🇫🇷', 'fr', 'Delhi'],
  ['United Kingdom', '🇬🇧', 'gb', 'Mumbai'],
  ['Spain', '🇪🇸', 'es', 'Goa'],
  ['United States', '🇺🇸', 'us', 'Delhi'],
  ['United Arab Emirates', '🇦🇪', 'ae', 'Delhi'],
  ['Japan', '🇯🇵', 'jp', 'Bengaluru'],
  ['South Korea', '🇰🇷', 'kr', 'Delhi'],
  ['Germany', '🇩🇪', 'de', 'Delhi'],
  ['Singapore', '🇸🇬', 'sg', 'Goa'],
  ['Turkey', '🇹🇷', 'tr', 'Delhi'],
  ['Australia', '🇦🇺', 'au', 'Delhi'],
  ['Canada', '🇨🇦', 'ca', 'Gurugram'],
  ['Thailand', '🇹🇭', 'th', 'Delhi'],
  ['Portugal', '🇵🇹', 'pt', 'Jaipur'],
  ['Netherlands', '🇳🇱', 'nl', 'Delhi'],
  ['Italy', '🇮🇹', 'it', 'Mumbai'],
  ['Brazil', '🇧🇷', 'br', 'Goa'],
  ['Mexico', '🇲🇽', 'mx', 'Delhi'],
  ['Sweden', '🇸🇪', 'se', 'Bengaluru'],
  ['Switzerland', '🇨🇭', 'ch', 'Delhi'],
  ['Ireland', '🇮🇪', 'ie', 'Mumbai'],
  ['Poland', '🇵🇱', 'pl', 'Delhi'],
  ['Norway', '🇳🇴', 'no', 'Goa'],
  ['Denmark', '🇩🇰', 'dk', 'Delhi'],
  ['Finland', '🇫🇮', 'fi', 'Bengaluru'],
  ['Greece', '🇬🇷', 'gr', 'Delhi'],
  ['Austria', '🇦🇹', 'at', 'Jaipur'],
  ['Belgium', '🇧🇪', 'be', 'Delhi'],
  ['Czechia', '🇨🇿', 'cz', 'Mumbai'],
  ['Hungary', '🇭🇺', 'hu', 'Delhi'],
  ['New Zealand', '🇳🇿', 'nz', 'Goa'],
  ['Malaysia', '🇲🇾', 'my', 'Delhi'],
  ['Indonesia', '🇮🇩', 'id', 'Mumbai'],
  ['Philippines', '🇵🇭', 'ph', 'Delhi'],
  ['Vietnam', '🇻🇳', 'vn', 'Goa'],
  ['Egypt', '🇪🇬', 'eg', 'Delhi'],
  ['South Africa', '🇿🇦', 'za', 'Bengaluru'],
  ['Argentina', '🇦🇷', 'ar', 'Delhi'],
  ['Chile', '🇨🇱', 'cl', 'Mumbai'],
  ['Kenya', '🇰🇪', 'ke', 'Delhi'],
];

const COUNTRY_ACCENTS = [
  '#F97316',
  '#22C55E',
  '#38BDF8',
  '#A855F7',
  '#EC4899',
];

export const MOCK_TRAVEL_COUNTRIES: TravelCountrySummary[] =
  COUNTRY_CARD_SEED.map(([country, flag, flagCode, city], index) => ({
    id: `c-${flagCode}`,
    country,
    flag,
    flagCode,
    flagUrl: `https://flagcdn.com/w80/${flagCode}.png`,
    arriving: 4 + ((index * 3) % 21),
    extra: 0,
    city,
    accent: COUNTRY_ACCENTS[index % COUNTRY_ACCENTS.length]!,
  }));

export const MOCK_TRAVEL_ARRIVALS: TravelArrival[] = [
  {
    id: 'travel-1',
    name: 'Chandan',
    age: 25,
    photo:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    coverPhoto: COVER_BEACH,
    flag: '🇮🇳',
    flagCode: 'in',
    nationality: 'India',
    from: 'Delhi, India',
    to: 'Bangkok, Thailand',
    fromCity: 'Delhi',
    fromCountry: 'India',
    toCity: 'Bangkok',
    toCountry: 'Thailand',
    toFlagCode: 'th',
    status: '2 days',
    tripType: 'business',
    city: 'Bangkok',
    country: 'Thailand',
    heightLabel: `5'9"`,
    zodiac: 'Leo',
    tags: [TAG_TRAVEL_BUDDY, TAG_BUSINESS, TAG_CASUAL],
    arrivalDate: '18 Oct 2025',
    purpose: 'Business',
    travelStyle: 'Solo',
    quote: 'New places, new people, same amazing journey!',
    isOnline: true,
    gender: 'man',
    isVerified: true,
  },
  {
    id: 'travel-2',
    name: 'Kabir',
    age: 38,
    photo:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    coverPhoto: COVER_CLIFF,
    flag: '🇵🇰',
    flagCode: 'pk',
    nationality: 'Pakistan',
    from: 'Karachi, Pakistan',
    to: 'Phuket, Thailand',
    fromCity: 'Karachi',
    fromCountry: 'Pakistan',
    toCity: 'Phuket',
    toCountry: 'Thailand',
    toFlagCode: 'th',
    status: '76d landed',
    tripType: 'vacation',
    city: 'Phuket',
    country: 'Thailand',
    heightLabel: `5'11"`,
    zodiac: 'Capricorn',
    tags: [TAG_TRAVEL_BUDDY, TAG_SHORT_TERM, TAG_CASUAL],
    arrivalDate: '02 Sep 2025',
    purpose: 'Holiday',
    travelStyle: 'Solo',
    quote: 'New places, new people, same amazing journey!',
    isOnline: false,
    gender: 'man',
  },
  {
    id: 'travel-3',
    name: 'Ananya',
    age: 24,
    photo:
      'https://images.unsplash.com/photo-1524504388940-b1c17226555e?auto=format&fit=crop&w=800&q=80',
    coverPhoto: COVER_BEACH,
    flag: '🇹🇭',
    flagCode: 'th',
    nationality: 'India',
    from: 'London, UK',
    to: 'Bangkok, Thailand',
    fromCity: 'London',
    fromCountry: 'UK',
    toCity: 'Bangkok',
    toCountry: 'Thailand',
    toFlagCode: 'th',
    status: '12 days',
    tripType: 'companion',
    city: 'Bangkok',
    country: 'Thailand',
    heightLabel: `5'4"`,
    zodiac: 'Taurus',
    tags: [TAG_TRAVEL_BUDDY, TAG_SHORT_TERM, TAG_CASUAL],
    arrivalDate: '12 Oct 2025',
    purpose: 'Holiday',
    travelStyle: 'Solo',
    quote: 'New places, new people, same amazing journey!',
    isOnline: true,
    gender: 'woman',
    showStatus: true,
    isVerified: true,
  },
  {
    id: 'travel-4',
    name: 'Maya',
    age: 25,
    photo:
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=800&q=80',
    coverPhoto: COVER_CLIFF,
    flag: '🇦🇪',
    flagCode: 'ae',
    nationality: 'UAE',
    from: 'Dubai, UAE',
    to: 'Paris, France',
    fromCity: 'Dubai',
    fromCountry: 'UAE',
    toCity: 'Paris',
    toCountry: 'France',
    toFlagCode: 'fr',
    status: '12d landed',
    tripType: 'solo',
    city: 'Paris',
    country: 'France',
    heightLabel: `5'6"`,
    zodiac: 'Gemini',
    tags: [TAG_SOLO, TAG_SHORT_TERM, TAG_CASUAL],
    arrivalDate: '05 Oct 2025',
    purpose: 'Holiday',
    travelStyle: 'Solo',
    quote: 'New places, new people, same amazing journey!',
    isOnline: true,
    gender: 'woman',
    showStatus: true,
    isVerified: true,
  },
  {
    id: 'travel-5',
    name: 'Sofia',
    age: 24,
    photo:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    coverPhoto: COVER_BEACH,
    flag: '🇪🇸',
    flagCode: 'es',
    nationality: 'Spain',
    from: 'Barcelona, Spain',
    to: 'New Delhi, India',
    fromCity: 'Barcelona',
    fromCountry: 'Spain',
    toCity: 'New Delhi',
    toCountry: 'India',
    toFlagCode: 'in',
    status: '5 days',
    tripType: 'vacation',
    city: 'New Delhi',
    country: 'India',
    heightLabel: `5'5"`,
    zodiac: 'Pisces',
    tags: [TAG_TRAVEL_BUDDY, TAG_SHORT_TERM, TAG_CASUAL],
    arrivalDate: '20 Oct 2025',
    purpose: 'Holiday',
    travelStyle: 'Couple',
    quote: 'New places, new people, same amazing journey!',
    isOnline: false,
    gender: 'woman',
    isVerified: true,
  },
  {
    id: 'travel-6',
    name: 'Noah',
    age: 29,
    photo:
      'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=800&q=80',
    coverPhoto: COVER_CLIFF,
    flag: '🇺🇸',
    flagCode: 'us',
    nationality: 'USA',
    from: 'New York, USA',
    to: 'Mumbai, India',
    fromCity: 'New York',
    fromCountry: 'USA',
    toCity: 'Mumbai',
    toCountry: 'India',
    toFlagCode: 'in',
    status: '3 days',
    tripType: 'business',
    city: 'Mumbai',
    country: 'India',
    heightLabel: `6'0"`,
    zodiac: 'Aries',
    tags: [TAG_BUSINESS, TAG_SHORT_TERM, TAG_CASUAL],
    arrivalDate: '15 Oct 2025',
    purpose: 'Business',
    travelStyle: 'Solo',
    quote: 'New places, new people, same amazing journey!',
    isOnline: true,
    gender: 'man',
  },
];

export function getTravelArrivalById(id: string): TravelArrival | undefined {
  return MOCK_TRAVEL_ARRIVALS.find(item => item.id === id);
}

export function countriesFromArrivals(
  arrivals: TravelArrival[],
): TravelCountrySummary[] {
  const summaries = new Map<string, TravelCountrySummary>();
  const cityCounts = new Map<string, Map<string, number>>();
  for (const item of arrivals) {
    const country = (item.fromCountry || '').trim();
    if (!country) {
      continue;
    }
    const destCity = item.toCity || item.city || country;
    const originCode =
      item.fromCountryCode || countryCodeForName(country);
    const originFlag =
      item.fromCountryFlag || (originCode ? flagUrl(originCode) : '');
    const cities = cityCounts.get(country) ?? new Map<string, number>();
    cities.set(destCity, (cities.get(destCity) ?? 0) + 1);
    cityCounts.set(country, cities);
    const existing = summaries.get(country);
    if (existing) {
      existing.arriving += 1;
      if (!existing.flagCode && originCode) {
        existing.flagCode = originCode;
        existing.flagUrl = originFlag;
      }
      continue;
    }
    summaries.set(country, {
      id: `c-${country.toLowerCase().replace(/\s+/g, '-')}`,
      country,
      flag: item.flag,
      flagCode: originCode,
      flagUrl: originFlag || undefined,
      arriving: 1,
      extra: 0,
      city: destCity,
      accent: COUNTRY_ACCENTS[summaries.size % COUNTRY_ACCENTS.length] ?? '#F97316',
    });
  }
  for (const summary of summaries.values()) {
    const cities = cityCounts.get(summary.country);
    if (!cities || cities.size === 0) {
      continue;
    }
    let topCity = summary.city;
    let topCount = 0;
    for (const [city, count] of cities) {
      if (count > topCount) {
        topCity = city;
        topCount = count;
      }
    }
    summary.city = topCity;
  }
  return [...summaries.values()];
}
