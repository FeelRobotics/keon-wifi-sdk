import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, makeJwtPayload } from './setup';
import { fetchOAuthTokens, refreshAccessToken, OAuthError } from '@/lib/oauth';
import { decodeJwt } from '@/lib/jwtDecode';

const BASE_URL = 'https://oauth-us.feelme.com';
const COGNITO_TOKEN = makeJwtPayload({ token_use: 'id', email: 'test@example.com' });

describe('fetchOAuthTokens', () => {
  it('returns access_token and refresh_token on success', async () => {
    const tokens = await fetchOAuthTokens(COGNITO_TOKEN, undefined, BASE_URL, 'test@example.com');
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
  });

  it('includes device_connection_key in access_token JWT claims', async () => {
    const tokens = await fetchOAuthTokens(COGNITO_TOKEN, undefined, BASE_URL, 'test@example.com');
    const claims = decodeJwt(tokens.access_token);
    expect(claims.device_connection_key).toBe('GNEU8LJA');
  });

  it('forwards provided device_connection_key in request body', async () => {
    let receivedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE_URL}/api/token/access`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          access_token: makeJwtPayload({ device_connection_key: 'GNEU8LJA' }),
          refresh_token: makeJwtPayload({ token_type: 'refresh' }),
        });
      }),
    );

    await fetchOAuthTokens(COGNITO_TOKEN, 'GNEU8LJA', BASE_URL, 'test@example.com');
    expect(receivedBody['device_connection_key']).toBe('GNEU8LJA');
  });

  it('does not include device_connection_key in body when undefined', async () => {
    let receivedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE_URL}/api/token/access`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          access_token: makeJwtPayload({}),
          refresh_token: makeJwtPayload({}),
        });
      }),
    );

    await fetchOAuthTokens(COGNITO_TOKEN, undefined, BASE_URL, 'test@example.com');
    expect(receivedBody).not.toHaveProperty('device_connection_key');
  });

  it('throws OAuthError on non-OK response', async () => {
    server.use(
      http.post(`${BASE_URL}/api/token/access`, () =>
        HttpResponse.json({ detail: 'Invalid token' }, { status: 401 }),
      ),
    );

    await expect(fetchOAuthTokens(COGNITO_TOKEN, undefined, BASE_URL, 'test@example.com')).rejects.toBeInstanceOf(
      OAuthError,
    );
  });

  it('sends user email as sub in request body', async () => {
    let receivedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE_URL}/api/token/access`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          access_token: makeJwtPayload({}),
          refresh_token: makeJwtPayload({}),
        });
      }),
    );

    await fetchOAuthTokens(COGNITO_TOKEN, undefined, BASE_URL, 'user@feelrobotics.com');
    expect((receivedBody['data'] as Record<string, unknown>)['sub']).toBe('user@feelrobotics.com');
  });

  it('sends Cognito ID token as Bearer in Authorization header', async () => {
    let authHeader: string | null = null;
    server.use(
      http.post(`${BASE_URL}/api/token/access`, ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return HttpResponse.json({
          access_token: makeJwtPayload({}),
          refresh_token: makeJwtPayload({}),
        });
      }),
    );

    await fetchOAuthTokens(COGNITO_TOKEN, undefined, BASE_URL, 'test@example.com');
    expect(authHeader).toBe(`Bearer ${COGNITO_TOKEN}`);
  });
});

describe('refreshAccessToken', () => {
  it('returns a new access_token string', async () => {
    const newToken = await refreshAccessToken('mock-refresh-token', BASE_URL);
    expect(typeof newToken).toBe('string');
    expect(newToken.length).toBeGreaterThan(0);
  });

  it('throws OAuthError on failure', async () => {
    server.use(
      http.post(`${BASE_URL}/api/token/refresh`, () =>
        HttpResponse.json({ detail: 'Expired' }, { status: 401 }),
      ),
    );

    await expect(refreshAccessToken('bad-token', BASE_URL)).rejects.toBeInstanceOf(OAuthError);
  });
});
