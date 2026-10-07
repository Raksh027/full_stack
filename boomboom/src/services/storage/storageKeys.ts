export const StorageKeys = {
  preferences: 'preferences.v1',
  sessionUser: 'session.user.v1',
  authTokens: 'session.tokens.v1',
  mockDatabase: 'dev.mock-db.v1',
  fcmDeviceId: 'push.device-id.v1',
  fcmRegistrationId: 'push.registration-id.v1',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
