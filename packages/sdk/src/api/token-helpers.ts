import { RegistrationTokenData, TokenPayload } from './models/AuthResponse';

import { jwtDecode } from 'jwt-decode';

const getTokenPayload = <T = any>(token: string): T | null => {
  if (!token) {
    return null;
  }

  try {
    return jwtDecode<T>(token);
  } catch {
    return null;
  }
};

/**
 * Checks whether a JWT is still fresh enough for local SDK reuse.
 *
 * This is not cryptographic validation: it does not verify the token signature,
 * issuer, audience, or algorithm. Server-side endpoints remain the authority.
 */
const isTokenFreshEnough = (token: string | null | undefined): boolean => {
  if (!token) {
    return false;
  }

  const decodedToken = getTokenPayload<TokenPayload>(token);
  if (!decodedToken || typeof decodedToken.exp !== 'number') {
    return false;
  }

  const issuedAt =
    typeof decodedToken.iat === 'number' ? decodedToken.iat : decodedToken.exp;
  const expirationTime = decodedToken.exp * 1000;
  const issuedTime = issuedAt * 1000;
  const halfwayExpiration = expirationTime - (expirationTime - issuedTime) / 2;

  return Date.now() <= halfwayExpiration;
};

const getRegistrationTokenData = (
  token: string
): RegistrationTokenData | null => {
  const payload = getTokenPayload<TokenPayload<RegistrationTokenData>>(token);
  if (payload) {
    return payload.data;
  }
  return null;
};

const getWebSocketServerUrl = (token: string): string | null => {
  const tokenData = getRegistrationTokenData(token);
  if (tokenData) {
    return tokenData.wss_cc_server_url;
  }
  return null;
};

const getSocketNamespace = (token: string): string | null => {
  const tokenData = getRegistrationTokenData(token);
  if (tokenData) {
    return tokenData.socket_ns ?? null;
  }
  return null;
};

const getOAuthServerUrl = (token: string): string | null => {
  const tokenData = getRegistrationTokenData(token);
  if (tokenData) {
    return tokenData.oauth_server_url;
  }
  return null;
};

const getDeviceConnectionKey = (token: string): string | null => {
  const tokenData = getTokenPayload<TokenPayload>(token);
  if (tokenData) {
    return tokenData.device_connection_key;
  }
  return null;
};

export {
  getOAuthServerUrl,
  getDeviceConnectionKey,
  getSocketNamespace,
  getWebSocketServerUrl,
  isTokenFreshEnough,
};
