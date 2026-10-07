export type FreeTonightActivity =
  | 'dinner'
  | 'drinks'
  | 'partyBuddy'
  | 'cityTour'
  | 'dating';

export type FreeTonightPerson = {
  id: string;
  userId?: string;
  name: string;
  age: number;
  photo: string;
  featuredPhoto: string;
  distanceKm: number | null;
  timeLeft: string;
  endsIn: string;
  activity: FreeTonightActivity;
  flag: string;
  flagCode: string;
  countryCode?: string;
  countryFlag?: string;
  heightLabel: string;
  venue: string;
  tagline: string;
  lookingFor: string;
  meetTime?: string;
  isOwn?: boolean;
  isOnline: boolean;
  isVerified: boolean;
  gender: 'man' | 'woman';
  sexualOrientation?: string | null;
  viewsLeft: number;
  liked?: boolean;
};

type FilterLabelKey =
  | 'freeTonight.filterAll'
  | 'freeTonight.filterDinner'
  | 'freeTonight.filterDrinks'
  | 'freeTonight.filterPartyBuddy'
  | 'freeTonight.filterCityTour'
  | 'freeTonight.filterDating';

export const FREE_TONIGHT_FILTERS: {
  key: 'all' | FreeTonightActivity;
  labelKey: FilterLabelKey;
  emoji?: string;
}[] = [
  { key: 'all', labelKey: 'freeTonight.filterAll' },
  { key: 'dinner', labelKey: 'freeTonight.filterDinner', emoji: '🍽️' },
  { key: 'drinks', labelKey: 'freeTonight.filterDrinks', emoji: '🍸' },
  { key: 'partyBuddy', labelKey: 'freeTonight.filterPartyBuddy', emoji: '🎉' },
  { key: 'cityTour', labelKey: 'freeTonight.filterCityTour', emoji: '🗺️' },
  { key: 'dating', labelKey: 'freeTonight.filterDating', emoji: '💘' },
];

export const FREE_TONIGHT_ACTIVITY_META: Record<
  FreeTonightActivity,
  {
    labelKey: Exclude<FilterLabelKey, 'freeTonight.filterAll'>;
    emoji: string;
  }
> = {
  dinner: { labelKey: 'freeTonight.filterDinner', emoji: '🍽️' },
  drinks: { labelKey: 'freeTonight.filterDrinks', emoji: '🍸' },
  partyBuddy: { labelKey: 'freeTonight.filterPartyBuddy', emoji: '🎉' },
  cityTour: { labelKey: 'freeTonight.filterCityTour', emoji: '🗺️' },
  dating: { labelKey: 'freeTonight.filterDating', emoji: '💘' },
};

const ACTIVITY_ALIASES: Record<string, FreeTonightActivity> = {
  dinner: 'dinner',
  food: 'dinner',
  drinks: 'drinks',
  drink: 'drinks',
  coffee: 'drinks',
  bar: 'drinks',
  cocktails: 'drinks',
  partybuddy: 'partyBuddy',
  party: 'partyBuddy',
  club: 'partyBuddy',
  nightlife: 'partyBuddy',
  citytour: 'cityTour',
  city: 'cityTour',
  walk: 'cityTour',
  tour: 'cityTour',
  dating: 'dating',
  date: 'dating',
};

export function normalizeTonightActivity(
  value?: string | null,
): FreeTonightActivity {
  const raw = (value || '').trim();
  if (raw in FREE_TONIGHT_ACTIVITY_META) {
    return raw as FreeTonightActivity;
  }
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ACTIVITY_ALIASES[key] ?? 'dating';
}

export function tonightActivityMeta(value?: string | null) {
  return FREE_TONIGHT_ACTIVITY_META[normalizeTonightActivity(value)];
}

const FEATURED_DINNER =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';
const FEATURED_DRINKS =
  'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80';
const FEATURED_PARTY =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80';
const FEATURED_CITY =
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80';

export const MOCK_FREE_TONIGHT: FreeTonightPerson[] = [
  {
    id: 'all-10',
    name: 'Anaya',
    age: 24,
    photo:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    featuredPhoto:
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=1200&q=80',
    distanceKm: 1.2,
    timeLeft: '3h left',
    endsIn: '3h 12m',
    activity: 'dinner',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `5'4"`,
    venue: 'Connaught Place, Delhi',
    tagline: 'Looking to make good memories tonight ✨',
    lookingFor:
      "I'm up for good conversations, sharing laughs, and maybe grabbing dinner or exploring the city. Looking for someone who's kind, interesting, and spontaneous.",
    isOnline: true,
    isVerified: true,
    gender: 'woman',
    viewsLeft: 10,
  },
  {
    id: 'all-2',
    name: 'Riya',
    age: 23,
    photo:
      'https://images.unsplash.com/photo-1524504388940-b1c17226555e?auto=format&fit=crop&w=800&q=80',
    featuredPhoto: FEATURED_CITY,
    distanceKm: 2.4,
    timeLeft: '10m left',
    endsIn: '10m',
    activity: 'cityTour',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `5'5"`,
    venue: 'India Gate, Delhi',
    tagline: 'Down for a spontaneous city walk ✨',
    lookingFor:
      'Want someone chill to explore cafes, markets, and late-night street food. Keep it fun and easy.',
    isOnline: true,
    isVerified: true,
    gender: 'woman',
    viewsLeft: 8,
  },
  {
    id: 'all-3',
    name: 'Karan',
    age: 26,
    photo:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    featuredPhoto: FEATURED_PARTY,
    distanceKm: 3.1,
    timeLeft: '1h left',
    endsIn: '1h 05m',
    activity: 'partyBuddy',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `5'10"`,
    venue: 'Hauz Khas, Delhi',
    tagline: 'Party mood on. Need a buddy 🎉',
    lookingFor:
      'Looking for good vibes, music, and someone who can keep up with the night.',
    isOnline: true,
    isVerified: false,
    gender: 'man',
    viewsLeft: 10,
  },
  {
    id: 'all-4',
    name: 'Sneha',
    age: 22,
    photo:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    featuredPhoto: FEATURED_DRINKS,
    distanceKm: 4.8,
    timeLeft: '45m left',
    endsIn: '45m',
    activity: 'drinks',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `5'3"`,
    venue: 'Khan Market, Delhi',
    tagline: 'Cocktails and conversations tonight 🍸',
    lookingFor:
      'A relaxed drinks meetup with someone witty, kind, and easy to talk to.',
    isOnline: true,
    isVerified: true,
    gender: 'woman',
    viewsLeft: 7,
  },
  {
    id: 'all-5',
    name: 'Aisha',
    age: 25,
    photo:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    featuredPhoto: FEATURED_DINNER,
    distanceKm: 6.2,
    timeLeft: '2h left',
    endsIn: '2h 20m',
    activity: 'dating',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `5'6"`,
    venue: 'Saket, Delhi',
    tagline: 'Open to a genuine connection tonight ✨',
    lookingFor:
      'Looking for someone genuine for dinner, laughs, and maybe a little spark.',
    isOnline: false,
    isVerified: true,
    gender: 'woman',
    viewsLeft: 10,
  },
  {
    id: 'all-6',
    name: 'Dev',
    age: 27,
    photo:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    featuredPhoto: FEATURED_DRINKS,
    distanceKm: 8.5,
    timeLeft: '5h left',
    endsIn: '5h 10m',
    activity: 'drinks',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `5'11"`,
    venue: 'Cyber Hub, Gurgaon',
    tagline: 'After-work drinks? Count me in.',
    lookingFor:
      'Casual drinks, good conversation, and zero pressure. Just a fun night out.',
    isOnline: true,
    isVerified: false,
    gender: 'man',
    viewsLeft: 9,
  },
  {
    id: 'all-7',
    name: 'Meera',
    age: 24,
    photo:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    featuredPhoto: FEATURED_CITY,
    distanceKm: 12.0,
    timeLeft: '20m left',
    endsIn: '20m',
    activity: 'cityTour',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `5'4"`,
    venue: 'Old Delhi',
    tagline: 'Night walk through the city lights ✨',
    lookingFor:
      'Someone curious and spontaneous to wander food stalls and hidden corners.',
    isOnline: true,
    isVerified: true,
    gender: 'woman',
    viewsLeft: 6,
  },
  {
    id: 'all-1',
    name: 'Arjun',
    age: 28,
    photo:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    featuredPhoto: FEATURED_DINNER,
    distanceKm: 18.4,
    timeLeft: '4h left',
    endsIn: '4h 05m',
    activity: 'dating',
    flag: '🇮🇳',
    flagCode: 'in',
    heightLabel: `6'0"`,
    venue: 'South Extension, Delhi',
    tagline: 'Dinner plans and good company wanted.',
    lookingFor:
      'Looking for someone warm and interesting for dinner and a proper conversation.',
    isOnline: true,
    isVerified: true,
    gender: 'man',
    viewsLeft: 10,
  },
];

export function getFreeTonightPersonById(
  id: string,
): FreeTonightPerson | undefined {
  return MOCK_FREE_TONIGHT.find(item => item.id === id);
}
