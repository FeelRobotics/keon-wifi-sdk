import { RemoteManager } from './RemoteManager';
import { RemoteMessage } from '../core/commandCodec';
import { RemoteCallbacks } from '../core/types';
import { getCredentialForFecServer } from '../api/helpers';
import { SocketClient, socketIOClient } from '../api/socketio-client';
import { AuthError } from '../errors';

/**
 * WiFi transport: drives the device over a Socket.IO connection to the FEC
 * server. Status is pushed by the server via the status callback.
 */
export class WifiManager extends RemoteManager {
  readonly transport = 'wifi' as const;

  private socket: SocketClient | null = null;

  private constructor(callbacks: RemoteCallbacks) {
    super(callbacks);
  }

  /**
   * Exchanges the partner/registration tokens for socket credentials and
   * opens the connection.
   *
   * @throws {AuthError} when WebSocket credentials cannot be obtained.
   */
  static async connect(
    feelAppsToken: string,
    registrationToken: string,
    callbacks: RemoteCallbacks = {}
  ): Promise<WifiManager> {
    const [socketServerUrl, accessToken] = await getCredentialForFecServer(
      feelAppsToken,
      registrationToken
    );
    if (!socketServerUrl || !accessToken) {
      throw new AuthError('Failed to obtain WebSocket server credentials');
    }

    const manager = new WifiManager(callbacks);
    manager.socket = await socketIOClient({
      serverUrl: socketServerUrl,
      token: accessToken,
      onDeviceStatus: manager.handleStatus,
      onUserActivity: (message) => manager.onUserAction?.(message),
    });
    return manager;
  }

  // The FEC server pushes one device per event as { payload: { KEON|KEON2 } };
  // merge each into the per-device status set so multiple devices accumulate.
  private handleStatus = (data: Record<string, any>): void => {
    const status = this.unwrapStatus(data?.payload);
    if (status) this.upsertStatus(status);
  };

  protected async send(message: RemoteMessage): Promise<void> {
    this.socket?.sendMessage(message.event, message.payload);
  }

  async disconnect(): Promise<void> {
    this.socket?.close();
    this.socket = null;
  }
}
