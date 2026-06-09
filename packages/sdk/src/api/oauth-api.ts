import { AuthResponse, ResponseRegistrationToken } from './models/AuthResponse';
import { DEFAULT_OAUTH_SERVER_URL } from './helpers';

class OauthApiArgs {
  method: string = 'POST';
  baseUrl: string = '';
  path: string = '';
  params: string = '';
  options = {};
  headers?: Headers;
  data: unknown;

  get fullUrl(): string {
    return (
      this.baseUrl +
      this.path +
      (this.params ? '?' + new URLSearchParams(this.params) : '')
    );
  }
}

const oauthApi = async <T>(args: OauthApiArgs): Promise<T | null> => {
  // If the OAuth server URL is not filled in, we ignore the token receiving functionality.
  if (!args.baseUrl) {
    console.error('baseUrl not found', args);
    return null;
  }

  const rawResponse = await fetch(args.fullUrl, {
    method: args.method,
    headers: args.headers,
    body: args.data ? JSON.stringify(args.data) : null,
    ...args.options,
  });

  if (!rawResponse.ok) {
    const errorMessage = `status: ${rawResponse.status}. statusText:${
      rawResponse.statusText
    }. text:${await rawResponse.text()}.`;

    throw new Error(errorMessage);
  } else if (rawResponse.status === 204) {
    // No Content or not JSON type
    return null;
  } else {
    // Check if the response has content
    const contentType = rawResponse.headers.get('content-type');
    if (contentType) {
      return (await rawResponse.json()) as T;
    }
  }
  return null;
};

const fetchAccessToken = async (
  feelAppsToken: string,
  deviceConnectionKey: string | null = null
): Promise<[string | null, string | null]> => {
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${feelAppsToken}`);
  headers.set('Content-Type', 'application/json');

  const args = new OauthApiArgs();
  args.path = '/api/token/partner/access';
  args.headers = headers;
  if (deviceConnectionKey) {
    args.data = { device_connection_key: deviceConnectionKey };
  }
  args.baseUrl = DEFAULT_OAUTH_SERVER_URL;
  const response = await oauthApi<AuthResponse>(args);
  if (response && 'access_token' in response) {
    return [response.access_token, response.refresh_token];
  }
  return [null, null];
};

const fetchRegistrationToken = async (
  accessToken: string
): Promise<string | null> => {
  if (!accessToken) {
    console.error('fetchRegistrationToken: Access token is missing.');
    return null;
  }

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Content-Type', 'application/json');

  const args = new OauthApiArgs();
  args.path = '/api/token/registration';
  args.headers = headers;

  args.baseUrl = DEFAULT_OAUTH_SERVER_URL;
  const response = await oauthApi<ResponseRegistrationToken>(args);
  if (response && 'registration_token' in response) {
    return response.registration_token;
  }
  return null;
};

export { fetchAccessToken, fetchRegistrationToken };
