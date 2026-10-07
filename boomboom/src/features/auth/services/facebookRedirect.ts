/** Parses a Facebook OAuth redirect. `undefined` = not ours, `null` = cancelled. */
export function parseFacebookRedirect(url: string): string | null | undefined {
  if (!url) {
    return undefined;
  }
  const isOurs =
    url.includes('facebook-auth') ||
    url.includes('://authorize') ||
    url.includes('/authorize');
  if (!isOurs) {
    return undefined;
  }

  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?')
    ? url.slice(url.indexOf('?') + 1).split('#')[0]
    : '';
  const params = new URLSearchParams(hash || query);
  const error = params.get('error') || params.get('error_reason');
  if (error) {
    return null;
  }
  return params.get('access_token') || params.get('accessToken');
}
