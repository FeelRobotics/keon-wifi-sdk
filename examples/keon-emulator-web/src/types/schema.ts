/**
 * TypeScript mirror of cc_ws_server/web/websockets/schema.py.
 * Field names and semantics are faithful to the Python source.
 */

// ---------------------------------------------------------------------------
// DeviceCommand
// ---------------------------------------------------------------------------

export type DeviceCommandType = 'RAW' | 'MOVEMENT' | 'MOVEMENT_BETWEEN' | 'PAUSE';

export type DeviceCommandArgumentsType =
  | 'speed'
  | 'position'
  | 'min_position'
  | 'max_position'
  | 'raw_data';

export interface DeviceCommand {
  sid_to?: string | null;
  command_type?: DeviceCommandType | null;
  arguments?: Partial<Record<DeviceCommandArgumentsType, unknown>> | null;
  command_duration_ms?: number | null;
}

/** Serialized form produced by DeviceCommand.model_dump_raw() */
export interface DeviceCommandRaw {
  KEON: string;
  TIME: string;
  CD: number | null;
}

// ---------------------------------------------------------------------------
// DeviceSetup
// ---------------------------------------------------------------------------

export type DeviceSetupType =
  | 'speed_intensity_adjustment'
  | 'range_intensity_adjustment'
  | 'status_update_interval';

export type DeviceSetupArgumentsType = 'intensity' | 'interval';

export interface DeviceSetup {
  sid_to?: string | null;
  setup_type?: DeviceSetupType | null;
  arguments?: Partial<Record<DeviceSetupArgumentsType, unknown>> | null;
}

/** Serialized form produced by DeviceSetup.model_dump_raw() */
export interface DeviceSetupRaw {
  KEON: string;
}

// ---------------------------------------------------------------------------
// DeviceReprovision
// ---------------------------------------------------------------------------

export type DeviceReprovisionType = 'bt_mode' | 'reset_credentials';

export interface DeviceReprovision {
  sid_to?: string | null;
  reprovision_type?: DeviceReprovisionType | null;
  arguments?: Record<string, unknown> | null;
}

/** Serialized form produced by DeviceReprovision.model_dump_raw() */
export interface DeviceReprovisionRaw {
  KEON: string;
}

// ---------------------------------------------------------------------------
// FEC Root Namespace Event Names
// Mirrors FeelExchangeCenter/src/namespaces/shared/events.ts
// ---------------------------------------------------------------------------

/** Events the emulator (acting as device) listens for from FEC. */
export const FecServerEvent = {
  COMMAND_FOR_DEVICE: 'command_for_device',
  CHANGE_DEVICE_SETTINGS: 'change_device_settings',
  CHANGE_DEVICE_MODE: 'change_device_mode',
  REQUEST_DEVICE_STATUS: 'request_device_status',
  CONNECT_ERROR: 'connect_error',
} as const;

/** Events the emulator (acting as device) emits to FEC. */
export const FecClientEvent = {
  FSU: 'fsu',
  AFU: 'afu',
} as const;

/**
 * Short event-name aliases used by the CC server (FeelmeCommandCenterServer).
 * Source: cc_ws_server/web/websockets/schema.py EventType enum.
 * The emulator listens for both FEC long names AND these short aliases so it
 * works against either server.
 */
export const CcServerEvent = {
  COMMAND_FOR_DEVICE: 'cfd',
  CHANGE_DEVICE_SETTINGS: 'dfs',
  CHANGE_DEVICE_MODE: 'dfa',
  REQUEST_DEVICE_STATUS: 'rds',
} as const;
