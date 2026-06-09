import { describe, it, expect } from 'vitest';
import {
  positionToDisplayLevel,
  displayLevelToSvgY,
  parseDeviceCommand,
  parseDeviceSetup,
  parseDeviceReprovision,
  buildFsuPayload,
  calcAnimationUnitsPerMs,
  calcAnimationDurationMs,
  rangeIntensityToCoefficient,
  scaleMovementTarget,
  scaleRangeAroundCenter,
  speedIntensityToCoefficient,
  FULL_STROKE_MS_AT_MAX_SPEED,
  DISPLAY_LEVEL_MIN,
  DISPLAY_LEVEL_MAX,
} from '@/lib/position';
import type { DeviceCommandRaw, DeviceSetupRaw, DeviceReprovisionRaw } from '@/types/schema';
import type { KeonDeviceStatus } from '@/types/keon';
import { DEVICE_CONSTANTS } from '@/types/keon';

// ---------------------------------------------------------------------------
// positionToDisplayLevel — 15% floor invariant
// ---------------------------------------------------------------------------
describe('positionToDisplayLevel', () => {
  it('maps 0% to DISPLAY_LEVEL_MIN (15)', () => {
    expect(positionToDisplayLevel(0)).toBe(DISPLAY_LEVEL_MIN);
  });

  it('maps 100% to DISPLAY_LEVEL_MAX (100)', () => {
    expect(positionToDisplayLevel(100)).toBe(DISPLAY_LEVEL_MAX);
  });

  it('maps 50% to 57.5', () => {
    expect(positionToDisplayLevel(50)).toBeCloseTo(57.5);
  });

  it('clamps values below 0 to DISPLAY_LEVEL_MIN', () => {
    expect(positionToDisplayLevel(-10)).toBe(DISPLAY_LEVEL_MIN);
  });

  it('clamps values above 100 to DISPLAY_LEVEL_MAX', () => {
    expect(positionToDisplayLevel(150)).toBe(DISPLAY_LEVEL_MAX);
  });

  it('is monotonically increasing', () => {
    const levels = [0, 25, 50, 75, 100].map(positionToDisplayLevel);
    const pairs = levels.slice(1).map((level, index) => [level, levels[index] ?? level] as const);
    for (const [current, previous] of pairs) {
      expect(current).toBeGreaterThan(previous);
    }
  });
});

// ---------------------------------------------------------------------------
// displayLevelToSvgY
// ---------------------------------------------------------------------------
describe('displayLevelToSvgY', () => {
  const TOP = 25;
  const BOTTOM = 285;

  it('level 100 returns topY', () => {
    expect(displayLevelToSvgY(100, TOP, BOTTOM)).toBe(TOP);
  });

  it('level 0 returns bottomY', () => {
    expect(displayLevelToSvgY(0, TOP, BOTTOM)).toBe(BOTTOM);
  });

  it('level 50 returns midpoint', () => {
    expect(displayLevelToSvgY(50, TOP, BOTTOM)).toBeCloseTo((TOP + BOTTOM) / 2);
  });
});

// ---------------------------------------------------------------------------
// parseDeviceCommand
// ---------------------------------------------------------------------------
describe('parseDeviceCommand', () => {
  it('parses PAUSE ("00")', () => {
    const raw: DeviceCommandRaw = { KEON: '00', TIME: '0', CD: null };
    expect(parseDeviceCommand(raw)).toEqual({ type: 'PAUSE' });
  });

  it('parses MOVEMENT ("3 speed pos")', () => {
    const raw: DeviceCommandRaw = { KEON: '3 75 50', TIME: '0', CD: null };
    expect(parseDeviceCommand(raw)).toEqual({ type: 'MOVEMENT', speed: 75, position: 50 });
  });

  it('parses MOVEMENT_BETWEEN ("4 speed min max")', () => {
    const raw: DeviceCommandRaw = { KEON: '4 60 10 90', TIME: '0', CD: null };
    expect(parseDeviceCommand(raw)).toEqual({
      type: 'MOVEMENT_BETWEEN',
      speed: 60,
      minPosition: 10,
      maxPosition: 90,
    });
  });

  it('falls back to RAW for unknown strings', () => {
    const raw: DeviceCommandRaw = { KEON: 'CUSTOM_CMD', TIME: '0', CD: null };
    const result = parseDeviceCommand(raw);
    expect(result.type).toBe('RAW');
  });

  it('trims whitespace before parsing', () => {
    const raw: DeviceCommandRaw = { KEON: '  3 100 0  ', TIME: '0', CD: null };
    expect(parseDeviceCommand(raw)).toEqual({ type: 'MOVEMENT', speed: 100, position: 0 });
  });
});

// ---------------------------------------------------------------------------
// parseDeviceSetup
// ---------------------------------------------------------------------------
describe('parseDeviceSetup', () => {
  it('parses SPEED_INTENSITY_ADJUSTMENT ("00 N")', () => {
    const raw: DeviceSetupRaw = { KEON: '00 42' };
    expect(parseDeviceSetup(raw)).toEqual({ type: 'SPEED_INTENSITY_ADJUSTMENT', intensity: 42 });
  });

  it('parses RANGE_INTENSITY_ADJUSTMENT ("01 N")', () => {
    const raw: DeviceSetupRaw = { KEON: '01 80' };
    expect(parseDeviceSetup(raw)).toEqual({ type: 'RANGE_INTENSITY_ADJUSTMENT', intensity: 80 });
  });

  it('parses STATUS_UPDATE_INTERVAL ("02 N")', () => {
    const raw: DeviceSetupRaw = { KEON: '02 500' };
    expect(parseDeviceSetup(raw)).toEqual({ type: 'STATUS_UPDATE_INTERVAL', interval: 500 });
  });

  it('falls back to UNKNOWN for unrecognized strings', () => {
    const raw: DeviceSetupRaw = { KEON: '99 anything' };
    expect(parseDeviceSetup(raw)).toEqual({ type: 'UNKNOWN', raw: '99 anything' });
  });
});

// ---------------------------------------------------------------------------
// parseDeviceReprovision
// ---------------------------------------------------------------------------
describe('parseDeviceReprovision', () => {
  it('parses BT_MODE ("01")', () => {
    const raw: DeviceReprovisionRaw = { KEON: '01' };
    expect(parseDeviceReprovision(raw)).toEqual({ type: 'BT_MODE' });
  });

  it('parses RESET_CREDENTIALS ("02")', () => {
    const raw: DeviceReprovisionRaw = { KEON: '02' };
    expect(parseDeviceReprovision(raw)).toEqual({ type: 'RESET_CREDENTIALS' });
  });

  it('falls back to UNKNOWN for other strings', () => {
    const raw: DeviceReprovisionRaw = { KEON: '03' };
    expect(parseDeviceReprovision(raw)).toEqual({ type: 'UNKNOWN', raw: '03' });
  });
});

// ---------------------------------------------------------------------------
// buildFsuPayload
// ---------------------------------------------------------------------------
describe('buildFsuPayload', () => {
  const status: KeonDeviceStatus = {
    ble_address: DEVICE_CONSTANTS.BLE_ADDRESS,
    serial_number: DEVICE_CONSTANTS.SERIAL_NUMBER,
    battery_status: 80,
    status_package: DEVICE_CONSTANTS.STATUS_PACKAGE,
    encoder_pos: 50,
    motor_speed: 60,
    wifi_strength: DEVICE_CONSTANTS.WIFI_STRENGTH,
    intensity: 70,
    stroker_level: 30,
    firmware_version: DEVICE_CONSTANTS.FIRMWARE_VERSION,
    status_period: DEVICE_CONSTANTS.STATUS_PERIOD,
    error_code: DEVICE_CONSTANTS.ERROR_CODE,
  };

  it('wraps status under KEON key', () => {
    const payload = buildFsuPayload(status);
    expect(payload).toEqual({ KEON: status });
  });

  it('preserves all KeonDeviceStatus fields', () => {
    const { KEON } = buildFsuPayload(status);
    expect(KEON.encoder_pos).toBe(50);
    expect(KEON.intensity).toBe(70);
    expect(KEON.stroker_level).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Animation timing — 186 ms full-stroke at max speed invariant
// ---------------------------------------------------------------------------
describe('calcAnimationUnitsPerMs', () => {
  it('produces a positive rate for positive speeds', () => {
    expect(calcAnimationUnitsPerMs(100)).toBeGreaterThan(0);
  });

  it('scales linearly with speed', () => {
    expect(calcAnimationUnitsPerMs(100)).toBeCloseTo(2 * calcAnimationUnitsPerMs(50));
  });

  it('returns 0 for speed=0 (no movement, no division-by-zero)', () => {
    expect(calcAnimationUnitsPerMs(0)).toBe(0);
  });

  it('at speed=100, 186 ms produces a full-stroke (~100 units) of movement', () => {
    const ups = calcAnimationUnitsPerMs(100);
    const distance = ups * FULL_STROKE_MS_AT_MAX_SPEED;
    expect(distance).toBeCloseTo(100, 6);
  });

  it('FULL_STROKE_MS_AT_MAX_SPEED constant is 186', () => {
    expect(FULL_STROKE_MS_AT_MAX_SPEED).toBe(186);
  });
});

describe('calcAnimationDurationMs', () => {
  it('returns 186 ms for distance=100 at speed=100', () => {
    expect(calcAnimationDurationMs(100, 100)).toBeCloseTo(186);
  });

  it('returns 372 ms for distance=100 at speed=50 (half-speed)', () => {
    expect(calcAnimationDurationMs(50, 100)).toBeCloseTo(372);
  });

  it('returns half the time for half the distance', () => {
    expect(calcAnimationDurationMs(100, 50)).toBeCloseTo(93);
  });

  it('returns Infinity for speed=0', () => {
    expect(calcAnimationDurationMs(0, 100)).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats negative distance as magnitude', () => {
    expect(calcAnimationDurationMs(100, -100)).toBeCloseTo(186);
  });
});

describe('movement intensity coefficients', () => {
  it('normalizes speed intensity so 8 is 100%', () => {
    expect(speedIntensityToCoefficient(8)).toBe(1);
    expect(speedIntensityToCoefficient(6)).toBe(0.75);
  });

  it('normalizes range intensity so 4 is 100%', () => {
    expect(rangeIntensityToCoefficient(4)).toBe(1);
    expect(rangeIntensityToCoefficient(3)).toBe(0.75);
  });

  it('clamps coefficients to the supported scale', () => {
    expect(speedIntensityToCoefficient(20)).toBe(1);
    expect(rangeIntensityToCoefficient(-1)).toBe(0);
  });

  it('scales MOVEMENT targets from the current position', () => {
    expect(scaleMovementTarget(20, 100, 0.75)).toBe(80);
    expect(scaleMovementTarget(80, 20, 0.75)).toBe(35);
  });

  it('scales MOVEMENT_BETWEEN ranges around their center', () => {
    expect(scaleRangeAroundCenter(10, 90, 0.75)).toEqual({ min: 20, max: 80 });
  });
});
