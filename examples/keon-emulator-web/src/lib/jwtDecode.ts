export interface JwtClaims {
  device_connection_key?: string | undefined;
  user_email?: string | undefined;
  token_type?: string | undefined;
  exp?: number | undefined;
  iat?: number | undefined;
  [key: string]: unknown;
}

/**
 * Decodes the payload section of a JWT without verifying the signature.
 * Sufficient for reading claims client-side after the server has validated them.
 */
export function decodeJwt(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT: expected 3 parts separated by "."');
  }
  const payload = parts[1];
  if (!payload) {
    throw new Error('Invalid JWT: missing payload segment');
  }
  try {
    // Convert URL-safe base64 → standard base64, then pad to multiple of 4.
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json) as JwtClaims;
  } catch {
    throw new Error('Failed to decode JWT payload: malformed base64 or JSON');
  }
}
