import { getCredentialForFecServer } from '../src/api/helpers';
import * as tokenHelpers from '../src/api/token-helpers';
import * as oauthApi from '../src/api/oauth-api';

describe('getCredentialForFecServer', () => {
  beforeEach(() => {
    jest
      .spyOn(tokenHelpers, 'getOAuthServerUrl')
      .mockReturnValue('https://oauth.example.com');
    jest
      .spyOn(tokenHelpers, 'getDeviceConnectionKey')
      .mockReturnValue('device-key');
    jest
      .spyOn(tokenHelpers, 'getWebSocketServerUrl')
      .mockReturnValue('wss://socket.example.com');
    jest.spyOn(tokenHelpers, 'getSocketNamespace').mockReturnValue(null);
    jest
      .spyOn(oauthApi, 'fetchAccessToken')
      .mockResolvedValue(['access-tok', null]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns [socketServerUrl, accessToken] from registration token data', async () => {
    const [socketUrl, accessToken] = await getCredentialForFecServer(
      'partner-token',
      'registration-token'
    );

    expect(socketUrl).toBe('wss://socket.example.com');
    expect(accessToken).toBe('access-tok');
  });

  it('appends socket namespace to the returned socket URL', async () => {
    jest
      .spyOn(tokenHelpers, 'getWebSocketServerUrl')
      .mockReturnValue('wss://socket.example.com/');
    jest.spyOn(tokenHelpers, 'getSocketNamespace').mockReturnValue('/pubnub');

    const [socketUrl] = await getCredentialForFecServer(
      'partner-token',
      'registration-token'
    );

    expect(socketUrl).toBe('wss://socket.example.com/pubnub');
  });

  it('passes oauthServerUrl, feelAppsToken, and deviceConnectionKey to fetchAccessToken', async () => {
    const fetchSpy = jest
      .spyOn(oauthApi, 'fetchAccessToken')
      .mockResolvedValue(['tok', null]);
    jest
      .spyOn(tokenHelpers, 'getOAuthServerUrl')
      .mockReturnValue('https://oauth.server.com');
    jest
      .spyOn(tokenHelpers, 'getDeviceConnectionKey')
      .mockReturnValue('my-device-key');

    await getCredentialForFecServer('my-partner-token', 'reg-token');

    expect(fetchSpy).toHaveBeenCalledWith('my-partner-token', 'my-device-key');
  });

  it('returns [socketUrl, null] when fetchAccessToken yields no token', async () => {
    jest.spyOn(oauthApi, 'fetchAccessToken').mockResolvedValue([null, null]);

    const [socketUrl, accessToken] = await getCredentialForFecServer(
      'partner-token',
      'reg-token'
    );

    expect(socketUrl).toBe('wss://socket.example.com');
    expect(accessToken).toBeNull();
  });

  it('returns [null, accessToken] when registration token has no wss URL', async () => {
    jest
      .spyOn(tokenHelpers, 'getWebSocketServerUrl')
      .mockReturnValue(null as unknown as string);

    const [socketUrl, accessToken] = await getCredentialForFecServer(
      'partner-token',
      'reg-token'
    );

    expect(socketUrl).toBeNull();
    expect(accessToken).toBe('access-tok');
  });

  it('propagates errors thrown by fetchAccessToken', async () => {
    jest
      .spyOn(oauthApi, 'fetchAccessToken')
      .mockRejectedValue(new Error('Network failure'));

    await expect(
      getCredentialForFecServer('partner-token', 'reg-token')
    ).rejects.toThrow('Network failure');
  });
});
