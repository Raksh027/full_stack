import { parseFacebookRedirect } from '../facebookRedirect';

describe('parseFacebookRedirect', () => {
  it('reads the access token from the hash', () => {
    expect(
      parseFacebookRedirect('boomboom://facebook-auth#access_token=abc123&expires_in=1'),
    ).toBe('abc123');
  });

  it('treats Facebook errors as cancel', () => {
    expect(
      parseFacebookRedirect('boomboom://facebook-auth?error=access_denied'),
    ).toBeNull();
  });

  it('ignores unrelated URLs', () => {
    expect(parseFacebookRedirect('boomboom://other')).toBeUndefined();
  });
});
