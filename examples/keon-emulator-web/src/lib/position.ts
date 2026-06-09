import type { KeonDeviceStatus } from '@/types/keon';
import type { DeviceCommandRaw, DeviceSetupRaw, DeviceReprovisionRaw } from '@/types/schema';

// ---------------------------------------------------------------------------
// Position / display-level math
// ---------------------------------------------------------------------------

export const DISPLAY_LEVEL_MIN = 15; // 0% position sits at 15% vessel height
export const DISPLAY_LEVEL_MAX = 100;

/**
 * Maps a device position (0–100) to a vessel display level (15–100).
 * Invariant: positionToDisplayLevel(0) === 15.
 */
export function positionToDisplayLevel(position: number): number {
  const clamped = Math.min(100, Math.max(0, position));
  return DISPLAY_LEVEL_MIN + (clamped / 100) * (DISPLAY_LEVEL_MAX - DISPLAY_LEVEL_MIN);
}

/**
 * Maps a display level (0–100) to an SVG Y-coordinate.
 * Level 100 → topY (highest position), level 0 → bottomY (lowest).
 */
export function displayLevelToSvgY(displayLevel: number, topY: number, bottomY: number): number {
  return bottomY - (displayLevel / 100) * (bottomY - topY);
}

// ---------------------------------------------------------------------------
// KEON string parsers — DeviceCommand (from 'command_for_device' FEC event)
// ---------------------------------------------------------------------------

export interface ParsedMovementCmd {
  type: 'MOVEMENT';
  speed: number;
  position: number;
}

export interface ParsedMovementBetweenCmd {
  type: 'MOVEMENT_BETWEEN';
  speed: number;
  minPosition: number;
  maxPosition: number;
}

export interface ParsedPauseCmd {
  type: 'PAUSE';
}

export interface ParsedRawCmd {
  type: 'RAW';
  raw: string;
}

export type ParsedDeviceCommand =
  | ParsedMovementCmd
  | ParsedMovementBetweenCmd
  | ParsedPauseCmd
  | ParsedRawCmd;

/**
 * Parses the KEON string from a DeviceCommandRaw payload.
 * Mirrors DeviceCommand.model_dump_raw() in schema.py.
 */
export function parseDeviceCommand(raw: DeviceCommandRaw): ParsedDeviceCommand {
  const keon = raw.KEON.trim();

  if (keon === '00') {
    return { type: 'PAUSE' };
  }

  const parts = keon.split(/\s+/);
  const first = parts[0] ?? '';

  if (first === '3' && parts.length >= 3) {
    return {
      type: 'MOVEMENT',
      speed: Number(parts[1] ?? 0),
      position: Number(parts[2] ?? 0),
    };
  }

  if (first === '4' && parts.length >= 4) {
    return {
      type: 'MOVEMENT_BETWEEN',
      speed: Number(parts[1] ?? 0),
      minPosition: Number(parts[2] ?? 0),
      maxPosition: Number(parts[3] ?? 100),
    };
  }

  return { type: 'RAW', raw: keon };
}

// ---------------------------------------------------------------------------
// KEON string parsers — DeviceSetup (from 'change_device_settings' FEC event)
// ---------------------------------------------------------------------------

export interface ParsedSpeedIntensitySetup {
  type: 'SPEED_INTENSITY_ADJUSTMENT';
  intensity: number;
}

export interface ParsedRangeIntensitySetup {
  type: 'RANGE_INTENSITY_ADJUSTMENT';
  intensity: number;
}

export interface ParsedStatusIntervalSetup {
  type: 'STATUS_UPDATE_INTERVAL';
  interval: number;
}

export interface ParsedUnknownSetup {
  type: 'UNKNOWN';
  raw: string;
}

export type ParsedDeviceSetup =
  | ParsedSpeedIntensitySetup
  | ParsedRangeIntensitySetup
  | ParsedStatusIntervalSetup
  | ParsedUnknownSetup;

/**
 * Parses the KEON string from a DeviceSetupRaw payload.
 * Mirrors DeviceSetup.model_dump_raw() in schema.py.
 */
export function parseDeviceSetup(raw: DeviceSetupRaw): ParsedDeviceSetup {
  const parts = raw.KEON.trim().split(/\s+/);
  const first = parts[0] ?? '';

  if (first === '00' && parts.length >= 2) {
    return { type: 'SPEED_INTENSITY_ADJUSTMENT', intensity: Number(parts[1] ?? 0) };
  }

  if (first === '01' && parts.length >= 2) {
    return { type: 'RANGE_INTENSITY_ADJUSTMENT', intensity: Number(parts[1] ?? 0) };
  }

  if (first === '02' && parts.length >= 2) {
    return { type: 'STATUS_UPDATE_INTERVAL', interval: Number(parts[1] ?? 0) };
  }

  return { type: 'UNKNOWN', raw: raw.KEON };
}

// ---------------------------------------------------------------------------
// KEON string parsers — DeviceReprovision (from 'change_device_mode' FEC event)
// ---------------------------------------------------------------------------

export interface ParsedBtModeReprovision {
  type: 'BT_MODE';
}

export interface ParsedResetCredentialsReprovision {
  type: 'RESET_CREDENTIALS';
}

export interface ParsedUnknownReprovision {
  type: 'UNKNOWN';
  raw: string;
}

export type ParsedDeviceReprovision =
  | ParsedBtModeReprovision
  | ParsedResetCredentialsReprovision
  | ParsedUnknownReprovision;

/**
 * Parses the KEON string from a DeviceReprovisionRaw payload.
 * Mirrors DeviceReprovision.model_dump_raw() in schema.py.
 */
export function parseDeviceReprovision(raw: DeviceReprovisionRaw): ParsedDeviceReprovision {
  const keon = raw.KEON.trim();

  if (keon === '01') return { type: 'BT_MODE' };
  if (keon === '02') return { type: 'RESET_CREDENTIALS' };
  return { type: 'UNKNOWN', raw: keon };
}

// ---------------------------------------------------------------------------
// FSU payload builder
// ---------------------------------------------------------------------------

/**
 * Wraps a KeonDeviceStatus in the FSU envelope the FEC expects.
 * Partners receive this as data.payload.KEON.
 */
export function buildFsuPayload(status: KeonDeviceStatus): { KEON: KeonDeviceStatus } {
  return { KEON: status };
}

// ---------------------------------------------------------------------------
// Movement intensity coefficients
// ---------------------------------------------------------------------------

export const SPEED_INTENSITY_MAX = 8;
export const RANGE_INTENSITY_MAX = 4;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampPositionValue(value: number): number {
  return clampNumber(value, 0, 100);
}

export function speedIntensityToCoefficient(intensity: number): number {
  return clampNumber(intensity, 0, SPEED_INTENSITY_MAX) / SPEED_INTENSITY_MAX;
}

export function rangeIntensityToCoefficient(intensity: number): number {
  return clampNumber(intensity, 0, RANGE_INTENSITY_MAX) / RANGE_INTENSITY_MAX;
}

export function scaleMovementTarget(
  currentPosition: number,
  targetPosition: number,
  coefficient: number,
): number {
  const current = clampPositionValue(currentPosition);
  const target = clampPositionValue(targetPosition);
  return current + (target - current) * clampNumber(coefficient, 0, 1);
}

export function scaleRangeAroundCenter(
  minPosition: number,
  maxPosition: number,
  coefficient: number,
): { min: number; max: number } {
  const lower = Math.min(clampPositionValue(minPosition), clampPositionValue(maxPosition));
  const upper = Math.max(clampPositionValue(minPosition), clampPositionValue(maxPosition));
  const center = (lower + upper) / 2;
  const halfRange = ((upper - lower) * clampNumber(coefficient, 0, 1)) / 2;

  return {
    min: clampPositionValue(center - halfRange),
    max: clampPositionValue(center + halfRange),
  };
}

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

/**
 * Time to traverse the full piston stroke (0 → 100) at the maximum command
 * speed value (100). Lower speeds scale linearly: at speed=50, full stroke
 * takes 2 × FULL_STROKE_MS_AT_MAX_SPEED.
 */
export const FULL_STROKE_MS_AT_MAX_SPEED = 186;

/**
 * Position units per millisecond at the given speed (0–100).
 * Used by the RAF animation loop in VesselView.
 *
 * Invariant: at speed=100, traversing 100 units takes
 * FULL_STROKE_MS_AT_MAX_SPEED ms exactly.
 */
export function calcAnimationUnitsPerMs(speed: number): number {
  return Math.max(0, speed) / FULL_STROKE_MS_AT_MAX_SPEED;
}

/**
 * Total milliseconds the animation needs to travel `distance` units at `speed`.
 * Useful for computing CSS transition durations or for tests.
 */
export function calcAnimationDurationMs(speed: number, distance: number): number {
  const ups = calcAnimationUnitsPerMs(speed);
  if (ups === 0) return Number.POSITIVE_INFINITY;
  return Math.abs(distance) / ups;
}
