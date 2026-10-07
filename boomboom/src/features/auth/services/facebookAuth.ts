import { AppState, Linking } from 'react-native';

import { env } from '@/config/env';

import { parseFacebookRedirect } from './facebookRedirect';

export const FACEBOOK_REDIRECT_URI = 'boomboom://facebook-auth';

export function isFacebookSignInConfigured(): boolean {
  return Boolean(env.USE_MOCK_API || env.FACEBOOK_APP_ID);
}

/** Returns the Facebook access token, or `null` when the user cancels. */
export async function getFacebookAccessToken(): Promise<string | null> {
  if (env.USE_MOCK_API) {
    return 'mock-facebook-access-token';
  }
  const appId = env.FACEBOOK_APP_ID;
  if (!appId) {
    throw new Error(
      'Facebook Login is not configured. Set FACEBOOK_APP_ID and rebuild the app.',
    );
  }

  const authUrl =
    'https://www.facebook.com/v21.0/dialog/oauth' +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(FACEBOOK_REDIRECT_URI)}` +
    '&response_type=token' +
    `&scope=${encodeURIComponent('email,public_profile,user_birthday,user_gender')}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let opened = false;

    const finish = (token: string | null, error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      subscription.remove();
      appState.remove();
      if (error) {
        reject(error);
        return;
      }
      resolve(token);
    };

    const handleUrl = ({ url }: { url: string }) => {
      const token = parseFacebookRedirect(url);
      if (token === undefined) {
        return;
      }
      finish(token);
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active' || !opened) {
        return;
      }
      setTimeout(() => {
        if (!settled) {
          finish(null);
        }
      }, 1500);
    });

    Linking.openURL(authUrl)
      .then(() => {
        opened = true;
      })
      .catch(error => {
        finish(
          null,
          error instanceof Error
            ? error
            : new Error('Unable to open Facebook Login'),
        );
      });
  });
}
