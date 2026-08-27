/// <reference types="web-bluetooth" />

/** The communication channel a manager uses to reach the device. */
export type KeonTransport = 'ble' | 'wifi' | 'fug';

/**
 * Result of {@link getTokenForKeonWiFi}.
 */
export interface TokenResult {
  /** Registration token used to connect the WiFi (Socket.IO) transport. */
  registrationToken: string;
  /** Key that persists the device association across sessions. */
  deviceConnectionKey: string;
}

/**
 * Information read from a device during the BLE connection.
 */
export interface DeviceInfo {
  /** Bluetooth device id. */
  id: string;
  /** Bluetooth device name, if advertised. */
  name?: string;
  firmwareVersion: string | null;
  manufacturerName: string | null;
  serialNumber: string | null;
}

/**
 * Live status of a connected device (delivered over a remote transport).
 * Device reports can be partial; omitted fields have not been reported yet.
 */
export interface KeonDeviceStatus {
  ble_address?: string;
  serial_number?: string;
  battery_status?: number;
  status_package?: string;
  encoder_pos?: number;
  motor_speed?: number;
  wifi_strength?: number;
  intensity?: number;
  stroker_level?: number;
  firmware_version?: string;
  status_period?: number;
  error_code?: number;
}

/** Motor position reported by the device over BLE notifications. */
export interface KeonBlePosition {
  /** Position 0..100 (100 = fully retracted). */
  position: number;
  /** Speed, when reported; 0 otherwise. */
  speed: number;
}

/** Callbacks shared by the remote (server-backed) transports. */
export interface RemoteCallbacks {
  /**
   * Called whenever fresh device status arrives. A single connection key can
   * cover several devices, so this receives the full list (one entry per
   * device); it is empty when no device has reported yet.
   */
  onStatusChange?: (statuses: KeonDeviceStatus[]) => void;
  /** Called on physical user activity reported by the device. */
  onUserAction?: (message: unknown) => void;
  /** Called when status polling or command delivery fails. */
  onError?: (error: Error) => void;
}

/** Callbacks for the BLE transport. */
export interface BleCallbacks {
  /** Called with each motor position notification. */
  onPosition?: (position: KeonBlePosition) => void;
}

/**
 * The control surface common to every transport (BLE, WiFi, FUG). Consumer
 * code can hold a {@link KeonController} without knowing the transport.
 */
export interface KeonController {
  readonly transport: KeonTransport;
  /** Move to an absolute position at the given speed (both 0..100). */
  moveTo(speed: number, position: number): Promise<void>;
  /** Repeat movement between two positions at the given speed (all 0..100). */
  movementBetween(
    speed: number,
    minPosition: number,
    maxPosition: number
  ): Promise<void>;
  /** Stop any ongoing movement. */
  stop(): Promise<void>;
  /**
   * Latest known status of the primary (first reported) device, or null when
   * none is available. Remote transports may cover several devices — use
   * {@link RemoteController.getStatuses} to see them all.
   */
  getStatus(): KeonDeviceStatus | null;
  /** Tear down the connection. */
  disconnect(): Promise<void>;
}

/**
 * Server-backed transports (WiFi via Socket.IO, FUG via REST) additionally
 * expose device settings and re-provisioning commands routed by the server.
 */
export interface RemoteController extends KeonController {
  /** Statuses of every device reported on this connection (one per device). */
  getStatuses(): KeonDeviceStatus[];
  /** Set the device intensity as a percentage (0..100). */
  setIntensity(intensity: number): Promise<void>;
  /** Set how often the device reports its status, in the server's units (0..1000). */
  setStatusInterval(interval: number): Promise<void>;
  /** Ask the device to drop WiFi and return to Bluetooth mode. */
  switchToBtMode(): Promise<void>;
  /** Wipe the stored WiFi credentials on the device. */
  resetCredentials(): Promise<void>;
  /** Request an immediate status report. */
  forceStatusReport(): Promise<void>;
}

/**
 * The BLE transport additionally exposes direct battery reads, a self-test and
 * motor position notifications.
 */
export interface BleController extends KeonController {
  /** Device information read during {@link connect}. */
  readonly deviceInfo: DeviceInfo | null;
  readonly driverName: string;
  /** Read the battery level (0..100), or -1 when unavailable. */
  getBattery(): Promise<number>;
  /** Run a short movement to confirm the device responds. */
  testDevice(): Promise<void>;
  /** Subscribe to motor position notifications. */
  onPosition(callback: (position: KeonBlePosition) => void): void;
}
