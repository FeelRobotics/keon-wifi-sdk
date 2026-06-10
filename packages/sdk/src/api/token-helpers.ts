import { RegistrationTokenData, TokenPayload } from './models/AuthResponse';

import { jwtDecode } from 'jwt-decode';

const getTokenPayload = <T = any>(token: string): T | null => {
  if (!token) {
    return null;
  }

  return jwtDecode<T>(token);
};

const isTokenValid = (token: string | null | undefined): boolean => {
  if (!token) {
    return false;
  }

  const decodedToken = getTokenPayload<TokenPayload>(token);
  if (decodedToken && decodedToken.exp) {
    const halfwayExpiration = new Date(
      decodedToken.exp * 1000 -
      (decodedToken.exp * 1000 -
        (decodedToken.iat || decodedToken.exp) * 1000) /
      2
    );
    const currentTime = new Date(new Date().toISOString());

    if (currentTime > halfwayExpiration) {
      return false;
    }
  }
  return true;
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
  getWebSocketServerUrl,
  isTokenValid,
};
