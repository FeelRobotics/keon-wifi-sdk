import { describe, it, expect } from 'vitest';
import { decodeJwt } from '@/lib/jwtDecode';

function makeJwt(claims: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.sig`;
}

describe('decodeJwt', () => {
  it('decodes device_connection_key from JWT claims', () => {
    const token = makeJwt({ device_connection_key: 'GNEU8LJA', exp: 9999999999 });
    const claims = decodeJwt(token);
    expect(claims.device_connection_key).toBe('GNEU8LJA');
  });

  it('decodes user_email from JWT claims', () => {
    const token = makeJwt({ user_email: 'test@example.com' });
    expect(decodeJwt(token).user_email).toBe('test@example.com');
  });

  it('throws on malformed JWT (wrong number of parts)', () => {
    expect(() => decodeJwt('not.a.valid.jwt.with.too.many.parts')).toThrow();
    expect(() => decodeJwt('onlyone')).toThrow();
  });

  it('throws on invalid base64 payload', () => {
    expect(() => decodeJwt('aaa.!!!.sig')).toThrow();
  });

  it('returns an object with unknown extra claims', () => {
    const token = makeJwt({ custom_claim: 42, another: 'value' });
    const claims = decodeJwt(token);
    expect(claims['custom_claim']).toBe(42);
  });
});
