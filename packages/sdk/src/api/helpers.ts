import {
  getDeviceConnectionKey,
  getSocketNamespace,
  getWebSocketServerUrl,
} from './token-helpers';
import { fetchAccessToken } from './oauth-api';

/** FEC OAuth server the SDK authenticates against. */
export const DEFAULT_OAUTH_SERVER_URL = 'https://oauth-fec-us.feelme.com';

/** Base URL of the Feel Unified Gateway (FUG) REST API. */
export const DEFAULT_FUG_BASE_URL = 'https://fug-prd.feelme.com';

const buildSocketConnectionUrl = (
  serverUrl: string | null,
  socketNamespace: string | null
): string | null => {
  if (!serverUrl) {
    return null;
  }

  const namespace = socketNamespace?.trim();
  if (!namespace || namespace === '/') {
    return serverUrl;
  }

  const normalizedNamespace = namespace.startsWith('/')
    ? namespace
    : `/${namespace}`;

  return `${serverUrl.replace(/\/+$/, '')}${normalizedNamespace}`;
};

const getCredentialForFecServer = async (
  feelAppsToken: string,
  registrationToken: string
): Promise<[string | null, string | null]> => {
  const deviceConnectionKey = getDeviceConnectionKey(registrationToken);
  const socketServerUrl = getWebSocketServerUrl(registrationToken);
  const socketNamespace = getSocketNamespace(registrationToken);

  const [accessToken] = await fetchAccessToken(
    feelAppsToken,
    deviceConnectionKey
  );

  return [
    buildSocketConnectionUrl(socketServerUrl, socketNamespace),
    accessToken,
  ];
};

export { getCredentialForFecServer };
