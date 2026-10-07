import { Platform } from 'react-native';
import Config from 'react-native-config';
import { z } from 'zod';

// Android emulator reaches the host machine through 10.0.2.2, not localhost.
function reachableUrl(url: string): string {
  if (Platform.OS !== 'android') {
    return url;
  }
  return url
    .replace('://localhost', '://10.0.2.2')
    .replace('://127.0.0.1', '://10.0.2.2');
}

const optionalString = z
  .string()
  .optional()
  .transform(value => (value ? value : undefined));

const GOOGLE_CLIENT_FALLBACK =
  '1007433497372-qegb9sbltg88sk3mjajccmi1k5pp32hj.apps.googleusercontent.com';

const envSchema = z
  .object({
    APP_ENV: z.enum(['development', 'staging', 'production']),
    API_URL: z.url(),
    WS_URL: z.url(),
    GOOGLE_WEB_CLIENT_ID: optionalString,
    GOOGLE_IOS_CLIENT_ID: optionalString,
    FACEBOOK_APP_ID: optionalString,
    GOOGLE_MAPS_API_KEY: optionalString,
    USE_MOCK_API: z
      .enum(['true', 'false'])
      .optional()
      .transform(value => value === 'true'),
  })
  .refine(config => !(config.APP_ENV === 'production' && config.USE_MOCK_API), {
    message: 'USE_MOCK_API must not be enabled in production',
    path: ['USE_MOCK_API'],
  });

const parsed = envSchema.safeParse(Config);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = {
  ...parsed.data,
  API_URL: reachableUrl(parsed.data.API_URL),
  WS_URL: reachableUrl(parsed.data.WS_URL),
  GOOGLE_WEB_CLIENT_ID:
    parsed.data.GOOGLE_WEB_CLIENT_ID ?? GOOGLE_CLIENT_FALLBACK,
  GOOGLE_IOS_CLIENT_ID:
    parsed.data.GOOGLE_IOS_CLIENT_ID ??
    parsed.data.GOOGLE_WEB_CLIENT_ID ??
    GOOGLE_CLIENT_FALLBACK,
  isDev: __DEV__,
  isProduction: parsed.data.APP_ENV === 'production',
} as const;

export type Env = typeof env;
