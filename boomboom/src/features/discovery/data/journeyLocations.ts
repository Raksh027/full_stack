export type JourneyCountry = {
  name: string;
  code: string;
};

export const JOURNEY_COUNTRIES: JourneyCountry[] = [
  { name: 'Afghanistan', code: 'af' },
  { name: 'Australia', code: 'au' },
  { name: 'Austria', code: 'at' },
  { name: 'Bangladesh', code: 'bd' },
  { name: 'Belgium', code: 'be' },
  { name: 'Brazil', code: 'br' },
  { name: 'Canada', code: 'ca' },
  { name: 'China', code: 'cn' },
  { name: 'Egypt', code: 'eg' },
  { name: 'France', code: 'fr' },
  { name: 'Germany', code: 'de' },
  { name: 'India', code: 'in' },
  { name: 'Indonesia', code: 'id' },
  { name: 'Italy', code: 'it' },
  { name: 'Japan', code: 'jp' },
  { name: 'Malaysia', code: 'my' },
  { name: 'Nepal', code: 'np' },
  { name: 'Netherlands', code: 'nl' },
  { name: 'Pakistan', code: 'pk' },
  { name: 'Singapore', code: 'sg' },
  { name: 'Spain', code: 'es' },
  { name: 'Thailand', code: 'th' },
  { name: 'UAE', code: 'ae' },
  { name: 'UK', code: 'gb' },
  { name: 'USA', code: 'us' },
];

export const JOURNEY_CITIES: Record<string, string[]> = {
  India: ['New Delhi', 'Mumbai', 'Bengaluru', 'Goa'],
  USA: ['New York', 'Los Angeles', 'Chicago', 'Miami'],
  UK: ['London', 'Manchester', 'Edinburgh'],
  Thailand: ['Bangkok', 'Phuket', 'Chiang Mai', 'Krabi'],
  UAE: ['Dubai', 'Abu Dhabi'],
  Spain: ['Barcelona', 'Madrid', 'Valencia'],
  Germany: ['Berlin', 'Munich', 'Hamburg'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane'],
  Canada: ['Toronto', 'Vancouver', 'Montreal'],
  France: ['Paris', 'Lyon', 'Nice'],
  Japan: ['Tokyo', 'Osaka', 'Kyoto'],
  Brazil: ['São Paulo', 'Rio de Janeiro'],
  Pakistan: ['Karachi', 'Lahore', 'Islamabad'],
  Bangladesh: ['Dhaka', 'Chittagong'],
  Singapore: ['Singapore'],
  Malaysia: ['Kuala Lumpur', 'Penang'],
  Nepal: ['Kathmandu', 'Pokhara'],
  Indonesia: ['Bali', 'Jakarta'],
  Italy: ['Rome', 'Milan', 'Florence'],
  China: ['Beijing', 'Shanghai'],
  Egypt: ['Cairo', 'Alexandria'],
  Netherlands: ['Amsterdam', 'Rotterdam'],
  Belgium: ['Brussels', 'Antwerp'],
  Austria: ['Vienna', 'Salzburg'],
  Afghanistan: ['Kabul'],
};

export function flagUrl(code: string) {
  return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
}
