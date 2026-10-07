import type { TravelTripType } from './mockTravelArrivals';

export type JourneyTravelStyle = 'solo' | 'group' | 'backpacker' | 'couple';
export type JourneyCompanion = 'any' | 'male' | 'female';
export type JourneyStatus = 'upcoming' | 'active' | 'landed';

export type MyJourney = {
  id: string;
  fromCity: string;
  fromCountry: string;
  fromCountryCode?: string;
  fromCountryFlag?: string;
  fromState?: string;
  toCity: string;
  toCountry: string;
  toCountryCode?: string;
  toCountryFlag?: string;
  toState?: string;
  departure: string;
  returnDate: string;
  tripType: TravelTripType;
  travelStyle: JourneyTravelStyle;
  companion: JourneyCompanion;
  status: JourneyStatus;
  description: string;
  coverImage: string;
  hideFromCountry: boolean;
  hideFrom?: 'male' | 'female' | 'both' | null;
};

export const MOCK_MY_JOURNEYS: MyJourney[] = [
  {
    id: 'journey-1',
    fromCity: 'New Delhi',
    fromCountry: 'India',
    toCity: 'Bangkok',
    toCountry: 'Thailand',
    departure: '12 Oct 2026',
    returnDate: '18 Oct 2026',
    tripType: 'companion',
    travelStyle: 'solo',
    companion: 'any',
    status: 'upcoming',
    description:
      'Looking for a travel companion to explore temples, street food, and nightlife together.',
    coverImage:
      'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=900&q=80',
    hideFromCountry: false,
  },
  {
    id: 'journey-2',
    fromCity: 'Mumbai',
    fromCountry: 'India',
    toCity: 'Dubai',
    toCountry: 'UAE',
    departure: '2 Nov 2026',
    returnDate: '6 Nov 2026',
    tripType: 'tourGuide',
    travelStyle: 'solo',
    companion: 'male',
    status: 'upcoming',
    description:
      'Need a local tour guide for city landmarks, desert views, and evening walks.',
    coverImage:
      'https://images.unsplash.com/photo-1512453979798-5ea9330edf76?auto=format&fit=crop&w=900&q=80',
    hideFromCountry: true,
  },
  {
    id: 'journey-3',
    fromCity: 'Bengaluru',
    fromCountry: 'India',
    toCity: 'Bali',
    toCountry: 'Indonesia',
    departure: '20 Sep 2026',
    returnDate: '28 Sep 2026',
    tripType: 'massageSpa',
    travelStyle: 'couple',
    companion: 'any',
    status: 'active',
    description:
      'Planning massage and spa days, wellness rituals, and quiet beach evenings.',
    coverImage:
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
    hideFromCountry: false,
  },
];
