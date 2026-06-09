/// <reference types="web-bluetooth" />

/** BLE provisioning timing/protocol parameters that differ per device. */
export interface BleProvisioningProfile {
  /** Negotiated MTU used to size token chunks. */
  mtu: number;
  /** Bytes subtracted from the MTU when chunking the token. */
  tokenChunkOverhead: number;
  /** Delay between writes when the client cannot read a status code. */
  interPacketWaitMs: number;
}

/** Everything the BLE transport needs to talk to one device generation. */
export interface BleDeviceProfile {
  serviceUuid: number;
  motorCharUuid: number;
  batteryCharUuid: number;
  provCharUuid: number;
  /** Optional device-info characteristics read on connect. */
  infoChars?: { firmware?: number; manufacturer?: number; serial?: number };
  /** Highest position the firmware accepts (commands are clamped to it). */
  maxPosition: number;
  provisioning: BleProvisioningProfile;
  encodeMove(speed: number, position: number): Uint8Array<ArrayBuffer>;
  encodeMovementBetween(
    speed: number,
    minPosition: number,
    maxPosition: number
  ): Uint8Array<ArrayBuffer>;
  encodePause(): Uint8Array<ArrayBuffer>;
  encodeEnterMovementMode(): Uint8Array<ArrayBuffer>;
  decodePosition(value: DataView): number;
}

/**
 * A pluggable device driver. One file per device generation: declare the
 * driver object and add it to the `DRIVERS` array in `devices/index.ts`.
 * Removing a device is deleting its file and that one line.
 *
 * Drivers are pure data + pure functions — they never touch `navigator.bluetooth`.
 * All BLE I/O lives in `BleManager`.
 */
export interface KeonDeviceDriver {
  /** Advertised Bluetooth name, used both as the request filter and for matching. */
  name: string;
  /** Returns true when this driver should handle the selected device. */
  matches(device: BluetoothDevice): boolean;
  ble: BleDeviceProfile;
}
