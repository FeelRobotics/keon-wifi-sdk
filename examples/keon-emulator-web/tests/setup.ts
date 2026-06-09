import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJwtPayload(claims: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      ...claims,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${payload}.mock-sig`;
}

export { makeJwtPayload };

// ---------------------------------------------------------------------------
// Default MSW handlers (can be overridden per test with server.use())
// ---------------------------------------------------------------------------

export const handlers = [
  // Cognito InitiateAuth — success
  http.post('https://cognito-idp.us-east-1.amazonaws.com/', () =>
    HttpResponse.json({
      AuthenticationResult: {
        IdToken: makeJwtPayload({ email: 'test@example.com', token_use: 'id' }),
        AccessToken: makeJwtPayload({ token_use: 'access' }),
        RefreshToken: 'mock-refresh-token',
      },
    }),
  ),

  // OAuth token/access — success
  http.post('https://oauth-us.feelme.com/api/token/access', () =>
    HttpResponse.json({
      access_token: makeJwtPayload({
        device_connection_key: 'GNEU8LJA',
        token_type: 'access',
        user_email: 'test@example.com',
      }),
      refresh_token: makeJwtPayload({ token_type: 'refresh' }),
    }),
  ),

  // OAuth token/refresh — success
  http.post('https://oauth-us.feelme.com/api/token/refresh', () =>
    HttpResponse.json({
      access_token: makeJwtPayload({
        device_connection_key: 'GNEU8LJA',
        token_type: 'access',
      }),
    }),
  ),
];

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

// socket.io-client is mocked globally via vi.mock in individual test files.

// navigator.clipboard — augment without replacing navigator (preserves jsdom's
// window.localStorage and other host APIs).
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
});

// In-memory localStorage shim — vitest's jsdom doesn't expose Storage methods
// on globalThis reliably across versions. This gives tests a clean, isolated store.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  clear(): void { this.store.clear(); }
}

const memStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: memStorage,
  configurable: true,
  writable: true,
});
