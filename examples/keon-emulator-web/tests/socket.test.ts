import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeonSocketTransport } from '@/lib/socket';
import type { SocketTransportHandlers } from '@/lib/socket';
import { http, HttpResponse } from 'msw';
import { server, makeJwtPayload } from './setup';

// ---------------------------------------------------------------------------
// Mock socket.io-client
// ---------------------------------------------------------------------------

const mockEmit = vi.fn();
const mockDisconnect = vi.fn();
let mockConnected = false;
let mockListeners: Record<string, ((data?: unknown) => void)[]> = {};

const mockSocket = {
  get connected() {
    return mockConnected;
  },
  on(event: string, cb: (data?: unknown) => void) {
    const listeners = mockListeners[event] ?? [];
    listeners.push(cb);
    mockListeners[event] = listeners;
  },
  emit: mockEmit,
  disconnect: mockDisconnect,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

function fireEvent(event: string, data?: unknown) {
  const listeners = mockListeners[event];
  if (listeners) {
    for (const cb of listeners) cb(data);
  }
}

// Every reconnect re-binds events on the shared mock socket, so listeners
// accumulate; fire only the most recent one to model the latest socket.
function fireLast(event: string, data?: unknown) {
  mockListeners[event]?.at(-1)?.(data);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandlers(overrides: Partial<SocketTransportHandlers> = {}): SocketTransportHandlers {
  return {
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onError: vi.fn(),
    onCommandForDevice: vi.fn(),
    onChangeDeviceSettings: vi.fn(),
    onChangeDeviceMode: vi.fn(),
    onRequestDeviceStatus: vi.fn(),
    onLog: vi.fn(),
    onTokenRefreshed: vi.fn(),
    ...overrides,
  };
}

const BASE_CONFIG = {
  wsUrl: 'https://fec.feelme.com',
  accessToken: makeJwtPayload({ token_type: 'access' }),
  refreshToken: makeJwtPayload({ token_type: 'refresh' }),
  oauthBaseUrl: 'https://oauth-us.feelme.com',
};

describe('KeonSocketTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnected = false;
    mockListeners = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onConnect handler when socket connects', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    mockConnected = true;
    fireEvent('connect');

    expect(handlers.onConnect).toHaveBeenCalledOnce();
  });

  it('passes the access token as a Bearer Authorization in the handshake auth', async () => {
    const { io } = await import('socket.io-client');
    const ioSpy = vi.mocked(io);
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });

    transport.connect();

    expect(ioSpy).toHaveBeenCalledWith(
      BASE_CONFIG.wsUrl,
      expect.objectContaining({
        auth: { Authorization: `Bearer ${BASE_CONFIG.accessToken}` },
      }),
    );
  });

  it('calls onDisconnect handler when socket disconnects', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    fireEvent('disconnect', 'transport close');

    expect(handlers.onDisconnect).toHaveBeenCalledWith('transport close');
  });

  it('routes command_for_device to onCommandForDevice', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    const payload = { KEON: '3 50 75', TIME: '1234567', CD: null };
    fireEvent('command_for_device', payload);

    expect(handlers.onCommandForDevice).toHaveBeenCalledWith(payload);
  });

  it('routes CC server short alias "cfd" to onCommandForDevice', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    const payload = { KEON: '4 100 0 100', TIME: '5196839', CD: null };
    fireEvent('cfd', payload);

    expect(handlers.onCommandForDevice).toHaveBeenCalledWith(payload);
  });

  it('routes CC server short aliases dfs/dfa/rds', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    fireEvent('dfs', { KEON: '01 80' });
    fireEvent('dfa', { KEON: '01' });
    fireEvent('rds', { KEON: '500 0' });

    expect(handlers.onChangeDeviceSettings).toHaveBeenCalledWith({ KEON: '01 80' });
    expect(handlers.onChangeDeviceMode).toHaveBeenCalledWith({ KEON: '01' });
    expect(handlers.onRequestDeviceStatus).toHaveBeenCalledOnce();
  });

  it('routes change_device_settings to onChangeDeviceSettings', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    const payload = { KEON: '01 80' };
    fireEvent('change_device_settings', payload);

    expect(handlers.onChangeDeviceSettings).toHaveBeenCalledWith(payload);
  });

  it('routes change_device_mode to onChangeDeviceMode', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    const payload = { KEON: '01' };
    fireEvent('change_device_mode', payload);

    expect(handlers.onChangeDeviceMode).toHaveBeenCalledWith(payload);
  });

  it('routes request_device_status to onRequestDeviceStatus', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    fireEvent('request_device_status', { KEON: '500 0' });

    expect(handlers.onRequestDeviceStatus).toHaveBeenCalledOnce();
  });

  it('emits fsu event when sendStatus is called and socket is connected', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();
    mockConnected = true;

    const payload = { KEON: { ble_address: 'AA:BB:CC:DD:EE:FF' } } as never;
    transport.sendStatus(payload);

    expect(mockEmit).toHaveBeenCalledWith('fsu', payload);
  });

  it('does not emit fsu when socket is not connected', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();
    mockConnected = false;

    transport.sendStatus({ KEON: {} as never });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('calls disconnect on dispose', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();
    transport.dispose();

    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it('does not reconnect after dispose', async () => {
    const { io } = await import('socket.io-client');
    const ioSpy = vi.mocked(io);

    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();
    transport.dispose();

    const callsBefore = ioSpy.mock.calls.length;
    fireEvent('disconnect', 'io server disconnect');
    // Give time for async handleDisconnect
    await new Promise((r) => setTimeout(r, 50));

    expect(ioSpy.mock.calls.length).toBe(callsBefore);
  });

  it('calls onTokenRefreshed after successful token refresh', async () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    fireEvent('disconnect', 'io server disconnect');
    await new Promise((r) => setTimeout(r, 100));

    expect(handlers.onTokenRefreshed).toHaveBeenCalledOnce();
  });

  it('calls onError if token refresh fails', async () => {
    server.use(
      http.post('https://oauth-us.feelme.com/api/token/refresh', () =>
        HttpResponse.json({ detail: 'Expired' }, { status: 401 }),
      ),
    );

    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    fireEvent('disconnect', 'io server disconnect');
    await new Promise((r) => setTimeout(r, 100));

    expect(handlers.onError).toHaveBeenCalledOnce();
  });

  it('stops reconnecting after 5 failed reconnect attempts', async () => {
    const { io } = await import('socket.io-client');
    const ioSpy = vi.mocked(io);

    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    for (let i = 0; i < 6; i++) {
      fireLast('disconnect', 'io server disconnect');
      await new Promise((r) => setTimeout(r, 100));
    }

    // 1 initial connect + 5 reconnects; the 6th rejection gives up.
    expect(ioSpy).toHaveBeenCalledTimes(6);
    expect(handlers.onError).toHaveBeenCalledOnce();
    expect(handlers.onError).toHaveBeenCalledWith(new Error('Max reconnect attempts (5) reached'));
    expect(handlers.onLog).toHaveBeenCalledWith('error', 'reconnect:exhausted', { attempts: 5 });
  });

  it('resets the reconnect counter on a successful connection', async () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    for (let i = 0; i < 6; i++) {
      fireLast('connect'); // each successful connection resets the counter
      fireLast('disconnect', 'io server disconnect');
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('calls onLog for each significant event', () => {
    const handlers = makeHandlers();
    const transport = new KeonSocketTransport({ ...BASE_CONFIG, handlers });
    transport.connect();

    mockConnected = true;
    fireEvent('connect');

    expect(handlers.onLog).toHaveBeenCalled();
  });
});
