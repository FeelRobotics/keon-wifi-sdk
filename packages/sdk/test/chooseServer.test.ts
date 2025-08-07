import { chooseBestServer } from '../src/api/helpers';
import * as api from '../src/api/oauth-api';

describe('chooseServer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('selects the server with the lowest validation time', async () => {
    // All fetches succeed, returning [token, null]
    jest
      .spyOn(api, 'fetchAccessToken')
      .mockImplementation((baseUrl, feelAppsToken) =>
        Promise.resolve([`token-for-${baseUrl}`, null])
      );
    // Different validation times per server
    jest
      .spyOn(api, 'getTokenValidationTime')
      .mockImplementation((server, token) => {
        if (server?.endsWith('us.feelme.com')) return Promise.resolve(300);
        if (server?.includes('eu.feelme.com')) return Promise.resolve(200);
        return Promise.resolve(400);
      });

    const [bestServer, tokens] = await chooseBestServer('dummy-token');

    expect(bestServer).toBe('https://oauth-eu.feelme.com');
    expect(tokens).toEqual({
      'https://oauth-us.feelme.com': 'token-for-https://oauth-us.feelme.com',
      'https://oauth-eu.feelme.com': 'token-for-https://oauth-eu.feelme.com',
      'https://oauth-aus.feelme.com': 'token-for-https://oauth-aus.feelme.com',
    });
  });

  it('ignores servers where fetchAccessToken rejects', async () => {
    // US fails, EU and AUS succeed
    jest
      .spyOn(api, 'fetchAccessToken')
      .mockImplementation((baseUrl, feelAppsToken) => {
        if (baseUrl?.endsWith('-us.feelme.com')) {
          return Promise.reject(new Error('Fetch failed US'));
        }
        return Promise.resolve([`tok-${baseUrl}`, null]);
      });
    // Both remaining validations take 100ms
    jest.spyOn(api, 'getTokenValidationTime').mockResolvedValue(100);

    const [bestServer, tokens] = await chooseBestServer('another-token');

    expect(bestServer).toBe('https://oauth-eu.feelme.com');
    expect(tokens).toEqual({
      'https://oauth-eu.feelme.com': 'tok-https://oauth-eu.feelme.com',
      'https://oauth-aus.feelme.com': 'tok-https://oauth-aus.feelme.com',
    });
  });

  it('returns empty string and empty tokens if no fetch succeeds', async () => {
    // All fetches reject
    jest
      .spyOn(api, 'fetchAccessToken')
      .mockRejectedValue(new Error('No tokens'));

    const [bestServer, tokens] = await chooseBestServer('token-x');

    expect(bestServer).toBe('');
    expect(tokens).toEqual({});
  });

  it('skips servers where validation throws an error', async () => {
    // All fetches succeed
    jest
      .spyOn(api, 'fetchAccessToken')
      .mockResolvedValue(['valid-token', null]);
    // EU validation fails, US is fastest, AUS slower
    jest
      .spyOn(api, 'getTokenValidationTime')
      .mockImplementation((server, token) => {
        if (server?.includes('eu.feelme.com')) {
          return Promise.reject(new Error('Validation error EU'));
        }
        return Promise.resolve(server?.includes('us.feelme.com') ? 50 : 100);
      });

    const [bestServer, tokens] = await chooseBestServer('token-y');

    expect(bestServer).toBe('https://oauth-us.feelme.com');
    expect(tokens).toEqual({
      'https://oauth-us.feelme.com': 'valid-token',
      'https://oauth-eu.feelme.com': 'valid-token',
      'https://oauth-aus.feelme.com': 'valid-token',
    });
  });

  it('returns empty string if all validations fail but tokens are collected', async () => {
    // All fetches succeed
    jest.spyOn(api, 'fetchAccessToken').mockResolvedValue(['tok', null]);
    // All validations reject
    jest
      .spyOn(api, 'getTokenValidationTime')
      .mockRejectedValue(new Error('All validations failed'));

    const [bestServer, tokens] = await chooseBestServer('token-z');

    expect(bestServer).toBe('');
    expect(tokens).toEqual({
      'https://oauth-us.feelme.com': 'tok',
      'https://oauth-eu.feelme.com': 'tok',
      'https://oauth-aus.feelme.com': 'tok',
    });
  });
});
