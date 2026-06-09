import { io, type Socket } from 'socket.io-client';
import type { FsuPayload } from '@/types/keon';
import type { DeviceCommandRaw, DeviceSetupRaw, DeviceReprovisionRaw } from '@/types/schema';
import { FecServerEvent, FecClientEvent, CcServerEvent } from '@/types/schema';
import { refreshAccessToken } from '@/lib/oauth';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SocketTransportHandlers {
  onConnect(): void;
  onDisconnect(reason: string): void;
  onError(error: Error): void;
  onCommandForDevice(data: DeviceCommandRaw): void;
  onChangeDeviceSettings(data: DeviceSetupRaw): void;
  onChangeDeviceMode(data: DeviceReprovisionRaw): void;
  onRequestDeviceStatus(): void;
  onLog(direction: 'in' | 'out' | 'system' | 'error', event: string, data: unknown): void;
  onTokenRefreshed(newAccessToken: string): void;
}

export interface SocketTransportConfig {
  wsUrl: string;
  accessToken: string;
  refreshToken: string;
  oauthBaseUrl: string;
  handlers: SocketTransportHandlers;
}

/**
 * Thin Socket.IO transport layer for the Keon device emulator.
 * Connects to FeelExchangeCenter root namespace as a device identity.
 * Auth format: { Authorization: "Bearer <accessToken>" } per the CC server
 * Socket.IO handshake contract (cc_ws_server.web.utils.auth_user.authenticate_user).
 * FEC's root namespace auth middleware accepts the same shape.
 */
export class KeonSocketTransport {
  private socket: Socket | null = null;
  private disposed = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private accessToken: string;
  private readonly refreshToken: string;
  private readonly oauthBaseUrl: string;
  private readonly wsUrl: string;
  private readonly handlers: SocketTransportHandlers;

  constructor(config: SocketTransportConfig) {
    this.wsUrl = config.wsUrl;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.oauthBaseUrl = config.oauthBaseUrl;
    this.handlers = config.handlers;
  }

  connect(): void {
    if (this.disposed) return;
    this.handlers.onLog('system', 'connect', { url: this.wsUrl });

    const socket = io(this.wsUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { Authorization: `Bearer ${this.accessToken}` },
      reconnection: false, // we handle reconnection manually for token refresh
    });

    this.socket = socket;
    this.bindEvents(socket);
  }

  private bindEvents(socket: Socket): void {
    socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.handlers.onLog('system', 'connect:ok', { id: socket.id });
      this.handlers.onConnect();
    });

    socket.on('disconnect', (reason: string) => {
      this.handlers.onLog('system', 'disconnect', { reason });
      this.handlers.onDisconnect(reason);
      void this.handleDisconnect(reason);
    });

    socket.on('connect_error', (err: Error) => {
      this.handlers.onLog('error', FecServerEvent.CONNECT_ERROR, { message: err.message });
      this.handlers.onError(err);
    });

    // FEC long event names + CC server short aliases — bind both so the
    // emulator works against either server.
    const commandEvents = [FecServerEvent.COMMAND_FOR_DEVICE, CcServerEvent.COMMAND_FOR_DEVICE];
    const settingsEvents = [
      FecServerEvent.CHANGE_DEVICE_SETTINGS,
      CcServerEvent.CHANGE_DEVICE_SETTINGS,
    ];
    const modeEvents = [FecServerEvent.CHANGE_DEVICE_MODE, CcServerEvent.CHANGE_DEVICE_MODE];
    const statusEvents = [
      FecServerEvent.REQUEST_DEVICE_STATUS,
      CcServerEvent.REQUEST_DEVICE_STATUS,
    ];

    for (const ev of commandEvents) {
      socket.on(ev, (data: unknown) => {
        this.handlers.onLog('in', ev, data);
        this.handlers.onCommandForDevice(data as DeviceCommandRaw);
      });
    }

    for (const ev of settingsEvents) {
      socket.on(ev, (data: unknown) => {
        this.handlers.onLog('in', ev, data);
        this.handlers.onChangeDeviceSettings(data as DeviceSetupRaw);
      });
    }

    for (const ev of modeEvents) {
      socket.on(ev, (data: unknown) => {
        this.handlers.onLog('in', ev, data);
        this.handlers.onChangeDeviceMode(data as DeviceReprovisionRaw);
      });
    }

    for (const ev of statusEvents) {
      socket.on(ev, (data: unknown) => {
        this.handlers.onLog('in', ev, data);
        this.handlers.onRequestDeviceStatus();
      });
    }
  }

  private async handleDisconnect(reason: string): Promise<void> {
    if (this.disposed) return;
    // 'io server disconnect' typically means the server rejected auth.
    if (reason !== 'io server disconnect') return;

    // Stop after repeated rejections instead of looping disconnect→refresh→connect.
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handlers.onLog('error', 'reconnect:exhausted', { attempts: this.reconnectAttempts });
      this.handlers.onError(
        new Error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached`),
      );
      return;
    }
    this.reconnectAttempts++;

    try {
      const newToken = await refreshAccessToken(this.refreshToken, this.oauthBaseUrl);
      this.accessToken = newToken;
      this.handlers.onTokenRefreshed(newToken);
      this.handlers.onLog('system', 'token:refreshed', {});
      // Reconnect with new token.
      this.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.handlers.onLog('error', 'token:refresh:failed', { message });
      this.handlers.onError(new Error(`Token refresh failed: ${message}`));
    }
  }

  sendStatus(payload: FsuPayload): void {
    if (!this.socket?.connected) return;
    this.handlers.onLog('out', FecClientEvent.FSU, payload);
    this.socket.emit(FecClientEvent.FSU, payload);
  }

  dispose(): void {
    this.disposed = true;
    this.socket?.disconnect();
    this.socket = null;
  }
}
