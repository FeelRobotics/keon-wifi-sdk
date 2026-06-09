/**
 * TypeScript mirror of KeonDeviceStatus from
 * TOOLS/keon-wifi-sdk/packages/sdk/src/core/types.ts.
 * Field names are identical to the source.
 */
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

/** Payload the device emits on the 'fsu' event (wrapped for FEC routing). */
export interface FsuPayload {
  KEON: KeonDeviceStatus;
}

/** Hard-coded constants for fields not derived from commands or user input. */
export const DEVICE_CONSTANTS = {
  BLE_ADDRESS: 'AA:BB:CC:DD:EE:FF',
  SERIAL_NUMBER: 'KEON-EMULATOR-001',
  STATUS_PACKAGE: '01',
  WIFI_STRENGTH: 95,
  FIRMWARE_VERSION: '1.0.0-emulator',
  STATUS_PERIOD: 1000,
  ERROR_CODE: 0,
} as const;
