import {
  getDeviceConnectionKey,
  getOAuthServerUrl,
  getWebSocketServerUrl,
} from './token-helpers';
import { fetchAccessToken, getTokenValidationTime } from './oauth-api';

/**
 * Selects the best server from a list based on the minimum token validation time.
 * Requests tokens for each server and validates them.
 * @async
 * @function chooseBestServer
 * @returns {Promise<[string, Record<string, string | null>]>} - Promise resolving to a tuple:
 *   1) Best server (empty string if none are suitable),
 *   2) Object mapping each server URL to its access token.
 */
const chooseBestServer = async (
  feelAppsToken: string,
  deviceConnectionKey: string | null = null
): Promise<[string | null, string | null]> => {
  const serverList: string[] = [
    'https://oauth-us.feelme.com',
    'https://oauth-eu.feelme.com',
    'https://oauth-aus.feelme.com',
  ];
  const oauthServerApiUrl = process.env.REACT_APP_OAUTH_SERVER_API_URL;
  console.log('oauthServerApiUrl:', oauthServerApiUrl);

  if (oauthServerApiUrl) {
    serverList.push(oauthServerApiUrl);
  }

  const serverListResults = await Promise.allSettled(
    serverList.map(server =>
      fetchAccessToken(server, feelAppsToken, deviceConnectionKey)
    )
  );

  const resultsTokens: Record<string, string> = {};
  serverList.forEach((server, index) => {
    const result = serverListResults[index];
    if (result.status === 'fulfilled') {
      const [access_token] = result.value;
      resultsTokens[server] = access_token || '';
    }
  });

  let bestServer: string | null = null;
  let minValidationTime = Infinity;
  for (const [server, token] of Object.entries(resultsTokens)) {
    if (token) {
      try {
        const validationTime = await getTokenValidationTime(server, token);
        if (validationTime < minValidationTime) {
          minValidationTime = validationTime;
          bestServer = server;
        }
      } catch (error) {
        console.error(`Failed to validate token for server: ${server}`, error);
      }
    }
  }

  if (bestServer) {
    const accessToken = resultsTokens[bestServer];
    return [bestServer, accessToken];
  }

  return [null, null];
};

const getCredentialForCcWsServer = async (
  feelAppsToken: string,
  registrationToken: string
): Promise<[string | null, string | null]> => {
  const serverUrl = getOAuthServerUrl(registrationToken);
  const deviceConnectionKey = getDeviceConnectionKey(registrationToken);
  const socketServerUrl = getWebSocketServerUrl(registrationToken);

  const [accessToken, refreshToken] = await fetchAccessToken(
    serverUrl,
    feelAppsToken,
    deviceConnectionKey
  );

  return [socketServerUrl, accessToken];
};

export { chooseBestServer, getCredentialForCcWsServer };
