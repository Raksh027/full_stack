export const API_VERSION = 'v1';

export const API_TIMEOUT_MS = 15_000;

export const API_MAX_RETRIES = 2;

export const CACHE_TTL_SECONDS = {
  default: 120,
  feed: 300,
  profile: 600,
} as const;

export const PAGE_SIZE = {
  feed: 20,
  map: 30,
  matches: 20,
  conversations: 20,
  messages: 30,
  tonight: 12,
  travel: 12,
  travelCountries: 20,
  travelNationalities: 100,
  notifications: 20,
  blocks: 20,
  journeys: 20,
} as const;

export const REALTIME = {
  heartbeatIntervalMs: 25_000,
  initialReconnectDelayMs: 1_000,
  maxReconnectDelayMs: 30_000,
  unauthorizedCloseCode: 4401,
} as const;

export const PROFILE_RULES = {
  minAge: 18,
  maxAge: 100,
  maxPhotos: 8,
  minPhotos: 3,
  minNameLength: 2,
  maxNameLength: 50,
  maxBioLength: 500,
  minInterests: 3,
  maxInterests: 10,
} as const;

export const MESSAGE_MAX_LENGTH = 2_000;

export const EMAIL_VERIFICATION = {
  codeLength: 4,
  resendCooldownSeconds: 60,
} as const;

export const SPLASH_MIN_DURATION_MS = 3_500;

export const LEGAL_URLS = {
  terms: 'https://www.boomboom.com/terms',
  privacy: 'https://www.boomboom.com/privacy',
} as const;
