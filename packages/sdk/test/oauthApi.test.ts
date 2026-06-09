import { fetchAccessToken, fetchRegistrationToken } from '../src/api/oauth-api';

function mockFetch(
  overrides: Partial<Response & { json: () => Promise<unknown> }>
): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
    text: async () => '',
    ...overrides,
  } as Response);
}

describe('fetchAccessToken', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns [accessToken, refreshToken] on success', async () => {
    mockFetch({
      json: async () => ({ access_token: 'acc', refresh_token: 'ref' }),
    });

    const [accessToken, refreshToken] = await fetchAccessToken(
      'https://oauth.example.com',
      'partner-token'
    );

    expect(accessToken).toBe('acc');
    expect(refreshToken).toBe('ref');
  });

  it('returns [null, null] when response lacks access_token', async () => {
    mockFetch({ json: async () => ({ unrelated: 'value' }) });

    const result = await fetchAccessToken('https://oauth.example.com', 'tok');
    expect(result).toEqual([null, null]);
  });

  it('sends the partner token as Authorization header', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ access_token: 'tok', refresh_token: null }),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await fetchAccessToken('my-partner-token');

    const headers: Headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers.get('Authorization')).toBe('Bearer my-partner-token');
  });

  it('sends deviceConnectionKey in the body when provided', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ access_token: 'tok', refresh_token: null }),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await fetchAccessToken('tok', 'device-key-123');

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toEqual({ device_connection_key: 'device-key-123' });
  });

  it('sends a null body when deviceConnectionKey is not provided', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ access_token: 'tok', refresh_token: null }),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await fetchAccessToken('partner-tok');

    expect(fetchSpy.mock.calls[0][1].body).toBeNull();
  });

  it('throws when the server returns a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'invalid token',
    } as unknown as Response);

    await expect(
      fetchAccessToken('https://oauth.example.com', 'bad-token')
    ).rejects.toThrow('401');
  });

  it('propagates network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

    await expect(
      fetchAccessToken('https://oauth.example.com', 'tok')
    ).rejects.toThrow('Network failure');
  });
});

describe('fetchRegistrationToken', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns registration_token on success', async () => {
    mockFetch({ json: async () => ({ registration_token: 'reg-tok-123' }) });

    const token = await fetchRegistrationToken('access-token');
    expect(token).toBe('reg-tok-123');
  });

  it('returns null without calling fetch when accessToken is empty', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    const result = await fetchRegistrationToken('');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when response lacks registration_token', async () => {
    mockFetch({ json: async () => ({ other_field: 'value' }) });

    const result = await fetchRegistrationToken('acc');
    expect(result).toBeNull();
  });

  it('sends the access token as Authorization header', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ registration_token: 'reg' }),
    } as unknown as Response);
    global.fetch = fetchSpy;

    await fetchRegistrationToken('my-access-token');

    const headers: Headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers.get('Authorization')).toBe('Bearer my-access-token');
  });

  it('throws when the server returns a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'forbidden',
    } as unknown as Response);

    await expect(fetchRegistrationToken('access-token')).rejects.toThrow('403');
  });
});
