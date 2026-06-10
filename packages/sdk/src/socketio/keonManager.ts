import { SocketClient, socketIOClient } from '../api/socketio-client';
import { wait } from '../utils/helpers';

const DEFAULT_COMMAND_INTERVAL_MS = 200;
export interface KeonManagerOptions {
  socketServerUrl: string;
  accessToken: string;
  userActionHandler: (message: any) => void;
}
export interface KeonDeviceStatus {
  ble_address: string;
  serial_number: string;
  battery_status: number;
  status_package: string;
  encoder_pos: number;
  motor_speed: number;
  wifi_strength: number;
  intensity: number;
  stroker_level: number;
  firmware_version: string;
  status_period: number;
  error_code: number;
}

export class KeonManager {
  private customerSocketIOClient: SocketClient | null = null;
  private deviceStatus: KeonDeviceStatus | null = null;

  socketServerUrl: string;
  accessToken: string;
  userActionHandler: (message: any) => void;

  constructor(options: KeonManagerOptions) {
    this.socketServerUrl = options.socketServerUrl;
    this.accessToken = options.accessToken;
    this.userActionHandler = options.userActionHandler;
  }

  private statusUpdateHandler = (data: Record<string, any>) => {
    if (data && typeof data === 'object' && data.payload && data.payload.KEON) {
      this.deviceStatus = data.payload.KEON as KeonDeviceStatus;
    } else {
      this.deviceStatus = null;
    }
  };

  async init(): Promise<SocketClient> {
    this.customerSocketIOClient = await socketIOClient({
      serverUrl: this.socketServerUrl,
      token: this.accessToken,
      onDeviceStatus: this.statusUpdateHandler,
      onUserActivity: this.userActionHandler,
    });
    return this.customerSocketIOClient;
  }

  async close(): Promise<void> {
    this.customerSocketIOClient?.close();
    this.customerSocketIOClient = null;
  }

  getDeviceStatus(): KeonDeviceStatus | null {
    return this.deviceStatus;
  }

  async moveTo(speed: number, position: number) {
    this.customerSocketIOClient?.sendMessage('send_command_to_devices', {
      command_type: 'MOVEMENT',
      arguments: { speed, position },
    });
  }

  async movementBetween(
    speed: number,
    min_position: number,
    max_position: number
  ) {
    this.customerSocketIOClient?.sendMessage('send_command_to_devices', {
      command_type: 'MOVEMENT_BETWEEN',
      arguments: { speed, min_position, max_position },
    });
  }
  async stopCommand() {
    this.customerSocketIOClient?.sendMessage('send_command_to_devices', {
      command_type: 'PAUSE',
      arguments: {},
    });
  }

  async forceStatusReport(): Promise<void> {
    this.customerSocketIOClient?.sendMessage('get_status_of_devices', {});
  }
  async setIntensityAdjustment(intensity: number) {
    this.customerSocketIOClient?.sendMessage('send_settings_to_device', {
      setup_type: 'speed_intensity_adjustment',
      arguments: { intensity: intensity * 2 },
    });
    await wait(DEFAULT_COMMAND_INTERVAL_MS);

    this.customerSocketIOClient?.sendMessage('send_settings_to_device', {
      setup_type: 'range_intensity_adjustment',
      arguments: { intensity },
    });
  }

  async setIntervalForUpdatingStatus(interval: number) {
    this.customerSocketIOClient?.sendMessage('send_settings_to_device', {
      setup_type: 'status_update_interval',
      arguments: { interval },
    });
  }

  async switchToBtMode() {
    this.customerSocketIOClient?.sendMessage(
      'send_reprovision_command_to_device',
      {
        reprovision_type: 'bt_mode',
        arguments: {},
      }
    );
  }

  async resetCredentials() {
    this.customerSocketIOClient?.sendMessage(
      'send_reprovision_command_to_device',
      {
        reprovision_type: 'reset_credentials',
        arguments: {},
      }
    );
  }
}
