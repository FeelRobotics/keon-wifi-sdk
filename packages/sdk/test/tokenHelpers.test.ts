import {
  getDeviceConnectionKey,
  getOAuthServerUrl,
  getSocketNamespace,
  getWebSocketServerUrl,
  isTokenFreshEnough,
} from '../src/api/token-helpers';

function makeJwt(payload: Record<string, unknown>): string {
  const enc = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`;
}

describe('token-helpers', () => {
  it('extracts device_connection_key', () => {
    const token = makeJwt({ device_connection_key: 'abc123' });
    expect(getDeviceConnectionKey(token)).toBe('abc123');
  });

  it('extracts oauth and websocket server urls from data', () => {
    const token = makeJwt({
      data: {
        oauth_server_url: 'https://oauth.example.com',
        wss_cc_server_url: 'wss://fec.example.com',
        socket_ns: '/pubnub',
      },
    });
    expect(getOAuthServerUrl(token)).toBe('https://oauth.example.com');
    expect(getWebSocketServerUrl(token)).toBe('wss://fec.example.com');
    expect(getSocketNamespace(token)).toBe('/pubnub');
  });

  describe('isTokenFreshEnough', () => {
    const now = Math.floor(Date.now() / 1000);

    it('returns false for null/empty', () => {
      expect(isTokenFreshEnough(null)).toBe(false);
      expect(isTokenFreshEnough('')).toBe(false);
    });

    it('returns false for malformed tokens', () => {
      expect(isTokenFreshEnough('not-a-jwt')).toBe(false);
    });

    it('returns true before the halfway point', () => {
      const token = makeJwt({ iat: now, exp: now + 3600 });
      expect(isTokenFreshEnough(token)).toBe(true);
    });

    it('returns false past the halfway point', () => {
      const token = makeJwt({ iat: now - 3600, exp: now + 10 });
      expect(isTokenFreshEnough(token)).toBe(false);
    });

    it('returns false when no exp claim is present', () => {
      const token = makeJwt({ user_id: 'u1' });
      expect(isTokenFreshEnough(token)).toBe(false);
    });
  });
});
