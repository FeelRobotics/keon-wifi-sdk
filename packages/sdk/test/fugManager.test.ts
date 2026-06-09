import { FugManager } from '../src/managers/FugManager';
import { KeonError } from '../src/errors';

const jsonResponse = (body: unknown) => ({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

describe('FugManager', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    (global as any).fetch = fetchMock;
  });

  afterEach(() => jest.restoreAllMocks());

  // Disable polling by default so tests don't leak the interval timer.
  const connect = (overrides = {}) =>
    FugManager.connect({
      deviceConnectionKey: 'dck-1',
      statusPollIntervalSec: 0,
      ...overrides,
    });

  it('throws when deviceConnectionKey is missing', async () => {
    await expect(
      FugManager.connect({ deviceConnectionKey: '' })
    ).rejects.toThrow(KeonError);
  });

  const callTo = (path: string) =>
    fetchMock.mock.calls.find(
      ([url]) => url === `https://fug-prd.feelme.com/api/${path}`
    );

  it('fetches status once on connect so a bad key surfaces immediately', async () => {
    await connect();

    expect(callTo('get_status_of_devices')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports an invalid key through onError instead of swallowing it', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });
    const onError = jest.fn();
    const onStatusChange = jest.fn();

    await connect({ onError, onStatusChange });

    expect(onError).toHaveBeenCalledWith(expect.any(KeonError));
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('reports poller failures through onError', async () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    const mgr = await connect({ onError, statusPollIntervalSec: 1 });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });

    await jest.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledWith(expect.any(KeonError));
    await mgr.disconnect();
    jest.useRealTimers();
  });

  it('POSTs a MOVEMENT command to /api/send_command_to_devices', async () => {
    const mgr = await connect();

    await mgr.moveTo(50, 90);

    const call = callTo('send_command_to_devices')!;
    expect(call[1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(call[1].body)).toEqual({
      command_type: 'MOVEMENT',
      arguments: { speed: 50, position: 90 },
    });
    expect(call[1].headers.Authorization).toBe('DCK dck-1');
  });

  it('POSTs settings to /api/send_setup_to_device (not send_settings_to_device)', async () => {
    const mgr = await connect();

    await mgr.setStatusInterval(5);

    expect(callTo('send_setup_to_device')).toBeDefined();
    expect(callTo('send_settings_to_device')).toBeUndefined();
  });

  it('fetches and applies status via forceStatusReport', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ KEON: { battery_status: 42 } }])
    );
    const onStatusChange = jest.fn();
    const mgr = await connect({ onStatusChange });

    await mgr.forceStatusReport();

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://fug-prd.feelme.com/api/get_status_of_devices'
    );
    expect(onStatusChange).toHaveBeenCalledWith([{ battery_status: 42 }]);
    expect(mgr.getStatus()).toEqual({ battery_status: 42 });
  });

  it('parses every device in the snapshot array (KEON and KEON2)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { KEON: { serial_number: 'A', battery_status: 42 } },
        { KEON2: { serial_number: 'B', battery_status: 99 } },
      ])
    );
    const mgr = await connect();

    await mgr.forceStatusReport();

    expect(mgr.getStatuses()).toEqual([
      { serial_number: 'A', battery_status: 42 },
      { serial_number: 'B', battery_status: 99 },
    ]);
    expect(mgr.getStatus()).toEqual({ serial_number: 'A', battery_status: 42 });
  });

  it('throws KeonError on a non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => null },
    });
    const mgr = await connect();

    await expect(mgr.stop()).rejects.toThrow(KeonError);
  });

  it('reports its transport', async () => {
    const mgr = await connect();
    expect(mgr.transport).toBe('fug');
  });
});
