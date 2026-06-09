import { RemoteManager } from './RemoteManager';
import { RemoteMessage } from '../core/commandCodec';
import { KeonDeviceStatus, RemoteCallbacks } from '../core/types';
import { DEFAULT_FUG_BASE_URL } from '../api/helpers';
import { KeonError } from '../errors';

/** Options for {@link FugManager.connect}. */
export interface FugConnectOptions extends RemoteCallbacks {
  /**
   * Device connection key — both the credential (sent as `Authorization: DCK
   * <key>`) and the target device identifier.
   */
  deviceConnectionKey: string;
  /**
   * How often to poll device status, in **seconds** (emits onStatusChange).
   * Defaults to {@link DEFAULT_STATUS_POLL_INTERVAL_SEC}. Set to `0` to disable
   * polling. {@link FugManager.connect} performs one initial status fetch
   * regardless of this setting.
   */
  statusPollIntervalSec?: number;
}

/** Default status poll interval (seconds) when none is supplied. */
export const DEFAULT_STATUS_POLL_INTERVAL_SEC = 30;

/**
 * The Socket.IO event vocabulary ({@link commandCodec}) and the FUG REST paths
 * agree on every command except device setup, which the gateway exposes as
 * `/api/send_setup_to_device` (the socket event is `send_settings_to_device`).
 */
const FUG_PATH_OVERRIDES: Record<string, string> = {
  send_settings_to_device: 'send_setup_to_device',
};

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * FUG transport: drives the device over the Feel Unified Gateway REST API. The
 * command vocabulary matches the WiFi transport; each command is POSTed to
 * `/api/<event>`. Status is pull-based — call {@link forceStatusReport} or rely
 * on the `statusPollIntervalSec` poller.
 */
export class FugManager extends RemoteManager {
  readonly transport = 'fug' as const;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly baseUrl = stripTrailingSlash(DEFAULT_FUG_BASE_URL);

  private constructor(
    private readonly deviceConnectionKey: string,
    callbacks: RemoteCallbacks
  ) {
    super(callbacks);
  }

  static async connect(options: FugConnectOptions): Promise<FugManager> {
    const {
      deviceConnectionKey,
      statusPollIntervalSec = DEFAULT_STATUS_POLL_INTERVAL_SEC,
      ...callbacks
    } = options;
    if (!deviceConnectionKey) {
      throw new KeonError('FUG deviceConnectionKey is required');
    }

    const manager = new FugManager(deviceConnectionKey, callbacks);
    // Surface an invalid/expired key immediately instead of waiting for the
    // first poll tick (or never, when polling is disabled).
    await manager.forceStatusReport().catch((err) => manager.emitError(err));
    if (statusPollIntervalSec > 0) {
      manager.pollTimer = setInterval(() => {
        void manager.forceStatusReport().catch((err) => manager.emitError(err));
      }, statusPollIntervalSec * 1000);
    }
    return manager;
  }

  protected async send(message: RemoteMessage): Promise<void> {
    await this.post(message.event, message.payload);
  }

  private async post(
    event: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const path = FUG_PATH_OVERRIDES[event] ?? event;
    const response = await fetch(`${this.baseUrl}/api/${path}`, {
      method: 'POST',
      headers: {
        // FUG authenticates on the device connection key, not a JWT.
        Authorization: `DCK ${this.deviceConnectionKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new KeonError(
        `FUG request "${event}" failed with status ${response.status}`
      );
    }
    const contentType = response.headers.get('content-type');
    return contentType && contentType.includes('json')
      ? await response.json()
      : null;
  }

  /** Fetches the latest status from the gateway and emits onStatusChange. */
  async forceStatusReport(): Promise<void> {
    const data = await this.post('get_status_of_devices', {});
    this.applyStatus(data);
  }

  private applyStatus(data: unknown): void {
    // The gateway returns a snapshot array of device-keyed status objects, one
    // per device in the room, e.g.
    // [{ "KEON": { battery_status: 100, ... } }, { "KEON2": { ... } }].
    const entries = Array.isArray(data) ? data : data == null ? [] : [data];
    const statuses = entries
      .map((entry) => this.unwrapStatus(entry))
      .filter((status): status is KeonDeviceStatus => status !== null);
    // The gateway returns an empty array when no device answered within its
    // timeout window; keep the last known statuses instead of clearing them.
    if (statuses.length > 0) this.setStatuses(statuses);
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
