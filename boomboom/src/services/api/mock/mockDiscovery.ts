const LIFESTYLE = {
  ethnicity: null,
  bodyType: null,
  heightRange: null,
  eyeColor: null,
  smoking: null,
  drinking: null,
  workout: null,
  personality: null,
} as const;

function photo(id: string, url: string, position: number) {
  return { id, url, position };
}

const EXTRA_PHOTOS = [
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80',
];

function person(input: {
  id: string;
  name: string;
  age: number;
  photo: string;
  distanceKm: number;
  country: string;
  city: string;
  relationshipGoal: string;
  isOnline: boolean;
  isNew: boolean;
  isVerified: boolean;
  gender?: 'man' | 'woman' | 'transgender' | 'nonbinary';
  bio?: string;
  interests?: string[];
  heightCm?: number;
  jobTitle?: string | null;
}) {
  const urls = [input.photo, ...EXTRA_PHOTOS];
  return {
    id: input.id,
    name: input.name,
    age: input.age,
    gender: input.gender ?? 'woman',
    sexualOrientation: null,
    showOrientation: false,
    bio: input.bio ?? 'Here for good conversation and late-night walks.',
    photos: urls.map((url, index) => photo(`${input.id}-${index}`, url, index)),
    interests: input.interests ?? ['music', 'travel', 'movies'],
    languages: ['english', 'hindi'],
    workCategory: null,
    relationshipGoal: input.relationshipGoal,
    lifestyle: {
      ...LIFESTYLE,
      bodyType: 'average',
    },
    jobTitle: input.jobTitle ?? null,
    company: null,
    school: null,
    heightCm: input.heightCm ?? 175,
    city: input.city,
    country: input.country,
    isVerified: input.isVerified,
    distanceKm: input.distanceKm,
    commonInterests: [],
    isOnline: input.isOnline,
    isNew: input.isNew,
  };
}

export const MOCK_DISCOVERY_FEED = [
  person({
    id: 'new-1',
    name: 'Benz',
    age: 26,
    photo:
      'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80',
    distanceKm: 19.8,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'marriage',
    isOnline: true,
    isNew: true,
    isVerified: true,
  }),
  person({
    id: 'new-2',
    name: 'Amara',
    age: 24,
    photo:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    distanceKm: 19.8,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'marriage',
    isOnline: true,
    isNew: true,
    isVerified: true,
  }),
  person({
    id: 'new-3',
    name: '123',
    age: 26,
    photo:
      'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=700&q=80',
    distanceKm: 8.2,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'casual',
    isOnline: true,
    isNew: true,
    isVerified: false,
  }),
  person({
    id: 'new-4',
    name: 'hhhh',
    age: 26,
    gender: 'man',
    photo:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80',
    distanceKm: 12.4,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'long_term',
    isOnline: true,
    isNew: true,
    isVerified: false,
  }),
  person({
    id: 'new-5',
    name: 'bbb',
    age: 26,
    photo:
      'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=700&q=80',
    distanceKm: 6.1,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'new_friends',
    isOnline: false,
    isNew: true,
    isVerified: true,
  }),
  person({
    id: 'all-1',
    name: 'Chirag',
    age: 24,
    photo:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80',
    distanceKm: 0.0,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'serious_love',
    isOnline: true,
    isNew: false,
    isVerified: false,
  }),
  person({
    id: 'all-2',
    name: 'Kapoor',
    age: 26,
    photo:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80',
    distanceKm: 0.0,
    country: 'Pakistan',
    city: 'New Delhi',
    relationshipGoal: 'casual',
    isOnline: true,
    isNew: false,
    isVerified: true,
  }),
  person({
    id: 'all-3',
    name: 'Sajan',
    age: 23,
    photo:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80',
    distanceKm: 0.3,
    country: 'UK',
    city: 'New Delhi',
    relationshipGoal: 'long_term',
    isOnline: true,
    isNew: false,
    isVerified: false,
  }),
  person({
    id: 'all-4',
    name: 'Noah',
    age: 27,
    photo:
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=700&q=80',
    distanceKm: 0.5,
    country: 'Canada',
    city: 'New Delhi',
    relationshipGoal: 'new_friends',
    isOnline: true,
    isNew: false,
    isVerified: true,
  }),
  person({
    id: 'all-5',
    name: 'Luc',
    age: 25,
    photo:
      'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=700&q=80',
    distanceKm: 0.8,
    country: 'France',
    city: 'New Delhi',
    relationshipGoal: 'marriage',
    isOnline: true,
    isNew: false,
    isVerified: false,
  }),
  person({
    id: 'all-6',
    name: 'Max',
    age: 28,
    photo:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=700&q=80',
    distanceKm: 1.1,
    country: 'Germany',
    city: 'New Delhi',
    relationshipGoal: 'casual',
    isOnline: true,
    isNew: false,
    isVerified: true,
  }),
  person({
    id: 'all-7',
    name: 'Kofi',
    age: 29,
    photo:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80',
    distanceKm: 5.5,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'new_friends',
    isOnline: true,
    isNew: false,
    isVerified: false,
  }),
  person({
    id: 'all-8',
    name: 'Noah',
    age: 27,
    photo:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80',
    distanceKm: 18.2,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'casual',
    isOnline: false,
    isNew: false,
    isVerified: false,
  }),
  person({
    id: 'all-9',
    name: 'James',
    age: 31,
    photo:
      'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=700&q=80',
    distanceKm: 14.7,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'marriage',
    isOnline: true,
    isNew: false,
    isVerified: true,
  }),
  person({
    id: 'all-10',
    name: 'Priya',
    age: 25,
    photo:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=700&q=80',
    distanceKm: 4.3,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'long_term',
    isOnline: true,
    isNew: false,
    isVerified: true,
  }),
  person({
    id: 'all-11',
    name: 'Sofia',
    age: 23,
    photo:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=80',
    distanceKm: 2.9,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'serious_love',
    isOnline: false,
    isNew: false,
    isVerified: false,
  }),
  person({
    id: 'all-12',
    name: 'Aisha',
    age: 27,
    photo:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=700&q=80',
    distanceKm: 8.6,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'new_friends',
    isOnline: true,
    isNew: false,
    isVerified: true,
  }),
  person({
    id: 'all-13',
    name: 'Mia',
    age: 22,
    photo:
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=700&q=80',
    distanceKm: 6.8,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'casual',
    isOnline: true,
    isNew: false,
    isVerified: false,
  }),
  person({
    id: 'all-14',
    name: 'Elena',
    age: 29,
    photo:
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=700&q=80',
    distanceKm: 10.1,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'marriage',
    isOnline: false,
    isNew: false,
    isVerified: true,
  }),
];

const PROFILE_ALIASES: Record<string, string> = {
  'u-amara': 'new-2',
  'u-jewel': 'all-2',
  'u-kofi': 'all-7',
  'u-darling': 'all-5',
  'u-zuhura': 'all-6',
  'u-james': 'all-9',
};

const EXTRA_PUBLIC_PROFILES = [
  person({
    id: 'u-maya',
    name: 'Maya',
    age: 26,
    photo:
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80',
    distanceKm: 2.4,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'long_term',
    isOnline: false,
    isNew: false,
    isVerified: true,
  }),
  person({
    id: 'u-lena',
    name: 'Lena',
    age: 23,
    photo:
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=900&q=80',
    distanceKm: 3.1,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'casual',
    isOnline: true,
    isNew: true,
    isVerified: false,
  }),
  person({
    id: 'travel-1',
    name: 'Chandan',
    age: 25,
    photo:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    distanceKm: 4.2,
    country: 'India',
    city: 'New Delhi',
    relationshipGoal: 'long_term',
    isOnline: true,
    isNew: false,
    isVerified: true,
    jobTitle: 'Business travel',
  }),
  person({
    id: 'travel-2',
    name: 'Kabir',
    age: 38,
    photo:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    distanceKm: 6.1,
    country: 'Pakistan',
    city: 'Karachi',
    relationshipGoal: 'casual',
    isOnline: false,
    isNew: false,
    isVerified: false,
    jobTitle: 'Vacation',
  }),
  person({
    id: 'travel-3',
    name: 'Alex',
    age: 27,
    photo:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    distanceKm: 3.8,
    country: 'India',
    city: 'Mumbai',
    relationshipGoal: 'new_friends',
    isOnline: true,
    isNew: false,
    isVerified: true,
    jobTitle: 'Nightlife',
  }),
  person({
    id: 'travel-4',
    name: 'Maya',
    age: 25,
    photo:
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7d?auto=format&fit=crop&w=800&q=80',
    distanceKm: 5.5,
    country: 'UAE',
    city: 'Dubai',
    relationshipGoal: 'serious_love',
    isOnline: false,
    isNew: false,
    isVerified: true,
    jobTitle: 'Solo travel',
  }),
  person({
    id: 'travel-5',
    name: 'Sofia',
    age: 24,
    photo:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    distanceKm: 2.9,
    country: 'Spain',
    city: 'Barcelona',
    relationshipGoal: 'casual',
    isOnline: true,
    isNew: false,
    isVerified: true,
    jobTitle: 'Vacation',
  }),
  person({
    id: 'travel-6',
    name: 'Noah',
    age: 29,
    photo:
      'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=800&q=80',
    distanceKm: 7.2,
    country: 'USA',
    city: 'New York',
    relationshipGoal: 'long_term',
    isOnline: false,
    isNew: false,
    isVerified: false,
    jobTitle: 'Business travel',
  }),
];

export function findMockPublicProfile(id: string) {
  const resolved = PROFILE_ALIASES[id] ?? id;
  const match =
    MOCK_DISCOVERY_FEED.find(item => item.id === resolved || item.id === id) ??
    EXTRA_PUBLIC_PROFILES.find(item => item.id === id);
  if (!match) {
    return null;
  }
  return match.id === id ? match : { ...match, id };
}
