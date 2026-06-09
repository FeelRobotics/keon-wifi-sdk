import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/appStore';
import { DEVICE_CONSTANTS } from '@/types/keon';
import { RANGE_INTENSITY_MAX, SPEED_INTENSITY_MAX } from '@/lib/position';

describe('buildDeviceStatus (store)', () => {
  beforeEach(() => {
    // Reset store to clean slate between tests
    useAppStore.setState({
      position: 0,
      speed: 0,
      intensity: SPEED_INTENSITY_MAX,
      strokerLevel: RANGE_INTENSITY_MAX,
      battery: 100,
      movementCommandBase: null,
      movementBetweenBase: null,
      animationParams: null,
    });
  });

  it('returns a fully-shaped KeonDeviceStatus', () => {
    const status = useAppStore.getState().buildDeviceStatus();

    expect(status).toMatchObject({
      ble_address: DEVICE_CONSTANTS.BLE_ADDRESS,
      serial_number: DEVICE_CONSTANTS.SERIAL_NUMBER,
      status_package: DEVICE_CONSTANTS.STATUS_PACKAGE,
      wifi_strength: DEVICE_CONSTANTS.WIFI_STRENGTH,
      firmware_version: DEVICE_CONSTANTS.FIRMWARE_VERSION,
      status_period: DEVICE_CONSTANTS.STATUS_PERIOD,
      error_code: DEVICE_CONSTANTS.ERROR_CODE,
    });
  });

  it('uses battery_status from store', () => {
    useAppStore.setState({ battery: 42 });
    const status = useAppStore.getState().buildDeviceStatus();
    expect(status.battery_status).toBe(42);
  });

  it('derives encoder_pos from current position', () => {
    useAppStore.getState().applyMovementCommand(50, 75);
    const status = useAppStore.getState().buildDeviceStatus();
    expect(status.encoder_pos).toBe(75);
  });

  it('derives motor_speed from last movement command', () => {
    useAppStore.getState().applyMovementCommand(88, 50);
    const status = useAppStore.getState().buildDeviceStatus();
    expect(status.motor_speed).toBe(88);
  });

  it('derives intensity from applySpeedIntensity', () => {
    useAppStore.getState().applySpeedIntensity(55);
    const status = useAppStore.getState().buildDeviceStatus();
    expect(status.intensity).toBe(55);
  });

  it('derives stroker_level from applyRangeIntensity', () => {
    useAppStore.getState().applyRangeIntensity(33);
    const status = useAppStore.getState().buildDeviceStatus();
    expect(status.stroker_level).toBe(33);
  });

  it('wraps status in { KEON } envelope via buildFsuPayload', () => {
    useAppStore.setState({ position: 60, speed: 40, intensity: 20, strokerLevel: 10 });
    const payload = useAppStore.getState().buildFsuPayload();
    expect(payload).toHaveProperty('KEON');
    expect(payload.KEON.encoder_pos).toBe(60);
  });
});

describe('applyMovementBetweenCommand', () => {
  beforeEach(() => {
    useAppStore.setState({
      animationParams: null,
      movementCommandBase: null,
      movementBetweenBase: null,
      position: 0,
      speed: 0,
      intensity: SPEED_INTENSITY_MAX,
      strokerLevel: RANGE_INTENSITY_MAX,
    });
  });

  it('sets animationParams', () => {
    useAppStore.getState().applyMovementBetweenCommand(70, 10, 90);
    const params = useAppStore.getState().animationParams;
    expect(params).toEqual({ min: 10, max: 90, speed: 70 });
  });

  it('applyPauseCommand clears animationParams', () => {
    useAppStore.getState().applyMovementBetweenCommand(70, 10, 90);
    useAppStore.getState().applyPauseCommand();
    expect(useAppStore.getState().animationParams).toBeNull();
  });

  it('applyMovementCommand clears animationParams', () => {
    useAppStore.getState().applyMovementBetweenCommand(70, 10, 90);
    useAppStore.getState().applyMovementCommand(50, 50);
    expect(useAppStore.getState().animationParams).toBeNull();
  });
});

describe('movement intensity coefficients', () => {
  beforeEach(() => {
    useAppStore.setState({
      animationParams: null,
      movementCommandBase: null,
      movementBetweenBase: null,
      position: 0,
      speed: 0,
      intensity: SPEED_INTENSITY_MAX,
      strokerLevel: RANGE_INTENSITY_MAX,
    });
  });

  it('applies speed and range coefficients to MOVEMENT', () => {
    useAppStore.getState().applySpeedIntensity(6);
    useAppStore.getState().applyRangeIntensity(3);
    useAppStore.getState().applyMovementCommand(80, 100);

    const state = useAppStore.getState();
    expect(state.speed).toBe(60);
    expect(state.position).toBe(75);
    expect(state.buildDeviceStatus()).toMatchObject({
      motor_speed: 60,
      encoder_pos: 75,
      intensity: 6,
      stroker_level: 3,
    });
  });

  it('applies speed and range coefficients to MOVEMENT_BETWEEN', () => {
    useAppStore.getState().applySpeedIntensity(6);
    useAppStore.getState().applyRangeIntensity(3);
    useAppStore.getState().applyMovementBetweenCommand(80, 10, 90);

    const state = useAppStore.getState();
    expect(state.speed).toBe(60);
    expect(state.animationParams).toEqual({ min: 20, max: 80, speed: 60 });
  });

  it('recalculates active movement from the raw command when dfs changes', () => {
    useAppStore.getState().applyMovementCommand(80, 100);
    useAppStore.getState().applySpeedIntensity(4);
    useAppStore.getState().applyRangeIntensity(2);

    expect(useAppStore.getState().speed).toBe(40);
    expect(useAppStore.getState().position).toBe(50);

    useAppStore.getState().applySpeedIntensity(8);
    useAppStore.getState().applyRangeIntensity(4);

    expect(useAppStore.getState().speed).toBe(80);
    expect(useAppStore.getState().position).toBe(100);
  });

  it('recalculates active range movement from the raw command when dfs changes', () => {
    useAppStore.getState().applyMovementBetweenCommand(80, 10, 90);
    useAppStore.getState().applySpeedIntensity(4);
    useAppStore.getState().applyRangeIntensity(2);
    useAppStore.getState().applySpeedIntensity(8);
    useAppStore.getState().applyRangeIntensity(4);

    expect(useAppStore.getState().animationParams).toEqual({ min: 10, max: 90, speed: 80 });
  });
});

describe('battery clamping', () => {
  it('clamps battery above 100', () => {
    useAppStore.getState().setBattery(150);
    expect(useAppStore.getState().battery).toBe(100);
  });

  it('clamps battery below 0', () => {
    useAppStore.getState().setBattery(-10);
    expect(useAppStore.getState().battery).toBe(0);
  });
});

describe('uppercase key enforcement (via store)', () => {
  it('stores the key as-is (uppercase enforced in component)', () => {
    useAppStore.getState().setDeviceConnectionKey('GNEU8LJA');
    expect(useAppStore.getState().deviceConnectionKey).toBe('GNEU8LJA');
  });
});

describe('deviceConnectionKey localStorage persistence', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  it('writes a valid 8-char key to localStorage', () => {
    useAppStore.getState().setDeviceConnectionKey('GNE5870A');
    expect(globalThis.localStorage?.getItem('keon-emulator:deviceConnectionKey')).toBe('GNE5870A');
  });

  it('does not persist incomplete keys', () => {
    useAppStore.getState().setDeviceConnectionKey('GNE587');
    expect(globalThis.localStorage?.getItem('keon-emulator:deviceConnectionKey')).toBeNull();
  });

  it('removes the entry when key is cleared', () => {
    useAppStore.getState().setDeviceConnectionKey('GNE5870A');
    useAppStore.getState().setDeviceConnectionKey('');
    expect(globalThis.localStorage?.getItem('keon-emulator:deviceConnectionKey')).toBeNull();
  });
});
