import type { OAuthAccessToken, OAuthTokens } from '@/types/api';

export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

/**
 * Calls POST /api/token/access on the OAuth server.
 * - cognitoIdToken is passed as Bearer in the Authorization header.
 * - deviceConnectionKey (optional) is forwarded in the JSON body.
 * - userEmail (optional) is forwarded as data.sub for downstream room binding.
 * Returns access_token and refresh_token.
 */
export async function fetchOAuthTokens(
  cognitoIdToken: string,
  deviceConnectionKey: string | undefined,
  baseUrl: string,
  userEmail?: string,
): Promise<OAuthTokens> {
  const url = `${baseUrl}/api/token/access`;
  const body: {
    device_connection_key?: string;
    data?: Record<string, string>;
  } = {};
  if (deviceConnectionKey) {
    body.device_connection_key = deviceConnectionKey;
  }
  if (userEmail) {
    body.data = { sub: userEmail };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cognitoIdToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new OAuthError(`token/access failed: ${response.status} ${text}`, response.status);
  }

  return (await response.json()) as OAuthTokens;
}

/**
 * Calls POST /api/token/refresh on the OAuth server.
 * - refreshToken is passed as Bearer in the Authorization header.
 * Returns a new access_token.
 */
export async function refreshAccessToken(refreshToken: string, baseUrl: string): Promise<string> {
  const url = `${baseUrl}/api/token/refresh`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new OAuthError(`token/refresh failed: ${response.status} ${text}`, response.status);
  }

  const data = (await response.json()) as OAuthAccessToken;
  return data.access_token;
}
