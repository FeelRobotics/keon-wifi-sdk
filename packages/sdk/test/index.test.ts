import { getTokenForKeonWiFi } from '../src/index';
import type { KeonDeviceStatus } from '../src/index';
import { AuthError } from '../src/errors';
import * as oauthApi from '../src/api/oauth-api';
import * as tokenHelpers from '../src/api/token-helpers';

afterEach(() => jest.restoreAllMocks());

describe('KeonDeviceStatus', () => {
  it('allows partial runtime payloads', () => {
    const status: KeonDeviceStatus = { battery_status: 80 };

    expect(status.battery_status).toBe(80);
  });
});

describe('getTokenForKeonWiFi', () => {
  beforeEach(() => {
    jest
      .spyOn(oauthApi, 'fetchAccessToken')
      .mockResolvedValue(['access-tok', null]);
    jest
      .spyOn(oauthApi, 'fetchRegistrationToken')
      .mockResolvedValue('reg-tok-abc');
    jest
      .spyOn(tokenHelpers, 'getDeviceConnectionKey')
      .mockReturnValue('device-key-xyz');
  });

  it('returns registrationToken and deviceConnectionKey on success', async () => {
    const result = await getTokenForKeonWiFi('feel-apps-token');

    expect(result).toEqual({
      registrationToken: 'reg-tok-abc',
      deviceConnectionKey: 'device-key-xyz',
    });
  });

  it('authenticates against the default OAuth server with the given keys', async () => {
    const fetchSpy = jest.spyOn(oauthApi, 'fetchAccessToken');

    await getTokenForKeonWiFi('partner-tok', 'existing-key');

    expect(fetchSpy).toHaveBeenCalledWith('partner-tok', 'existing-key');
  });

  it('forwards the partner token and deviceConnectionKey through both token requests', async () => {
    const accessSpy = jest.spyOn(oauthApi, 'fetchAccessToken');
    const registrationSpy = jest.spyOn(oauthApi, 'fetchRegistrationToken');

    await getTokenForKeonWiFi('partner-tok', null);

    expect(accessSpy).toHaveBeenCalledWith('partner-tok', null);
    expect(registrationSpy).toHaveBeenCalledWith('access-tok');
  });

  it('throws AuthError when authentication fails', async () => {
    jest.spyOn(oauthApi, 'fetchAccessToken').mockResolvedValue([null, null]);

    await expect(getTokenForKeonWiFi('tok')).rejects.toThrow(AuthError);
  });

  it('throws AuthError when registration token fetch fails', async () => {
    jest.spyOn(oauthApi, 'fetchRegistrationToken').mockResolvedValue(null);

    await expect(getTokenForKeonWiFi('tok')).rejects.toThrow(AuthError);
  });

  it('wraps a registration token fetch throw in AuthError', async () => {
    jest
      .spyOn(oauthApi, 'fetchRegistrationToken')
      .mockRejectedValue(new SyntaxError('Unexpected token < in JSON'));

    await expect(getTokenForKeonWiFi('tok')).rejects.toThrow(AuthError);
  });

  it('wraps a device connection key extraction throw in AuthError', async () => {
    jest
      .spyOn(tokenHelpers, 'getDeviceConnectionKey')
      .mockImplementation(() => {
        throw new Error('malformed token');
      });

    await expect(getTokenForKeonWiFi('tok')).rejects.toThrow(AuthError);
  });

  it('throws AuthError when device connection key is absent from the token', async () => {
    jest
      .spyOn(tokenHelpers, 'getDeviceConnectionKey')
      .mockReturnValue(null as unknown as string);

    await expect(getTokenForKeonWiFi('tok')).rejects.toThrow(AuthError);
  });
});
