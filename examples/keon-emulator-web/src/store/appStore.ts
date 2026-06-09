import { create } from 'zustand';
import type { LogEntry, LogDirection } from '@/types/api';
import type { KeonDeviceStatus } from '@/types/keon';
import { DEVICE_CONSTANTS } from '@/types/keon';
import {
  buildFsuPayload,
  RANGE_INTENSITY_MAX,
  SPEED_INTENSITY_MAX,
  rangeIntensityToCoefficient,
  scaleMovementTarget,
  scaleRangeAroundCenter,
  speedIntensityToCoefficient,
} from '@/lib/position';

export interface AnimationParams {
  min: number;
  max: number;
  speed: number;
}

interface MovementCommandBase {
  fromPosition: number;
  targetPosition: number;
  speed: number;
}

export interface AppState {
  // Auth & connection
  deviceConnectionKey: string;
  accessToken: string | null;
  refreshToken: string | null;
  socketStatus: 'disconnected' | 'connecting' | 'connected' | 'error';

  // Device state (drives the vessel visualization and FSU payload)
  position: number;      // 0–100, mirrors encoder_pos
  speed: number;         // 0–100, mirrors motor_speed
  intensity: number;     // raw SPEED_INTENSITY_ADJUSTMENT level, max 8
  strokerLevel: number;  // raw RANGE_INTENSITY_ADJUSTMENT level, max 4
  battery: number;       // 0–100, user-controlled

  // Last movement command before intensity coefficients are applied.
  movementCommandBase: MovementCommandBase | null;
  movementBetweenBase: AnimationParams | null;

  // Animation control for MOVEMENT_BETWEEN after intensity coefficients.
  animationParams: AnimationParams | null;

  // Log console
  logs: LogEntry[];
}

export interface AppActions {
  setDeviceConnectionKey: (key: string) => void;
  setTokens: (access: string, refresh: string) => void;
  updateAccessToken: (access: string) => void;
  setSocketStatus: (status: AppState['socketStatus']) => void;

  setPosition: (position: number) => void;
  applyMovementCommand: (speed: number, position: number) => void;
  applyMovementBetweenCommand: (speed: number, min: number, max: number) => void;
  applyPauseCommand: () => void;
  applySpeedIntensity: (intensity: number) => void;
  applyRangeIntensity: (intensity: number) => void;
  setBattery: (battery: number) => void;

  addLog: (direction: LogDirection, event: string, data: unknown) => void;
  clearLogs: () => void;

  buildDeviceStatus: () => KeonDeviceStatus;
  buildFsuPayload: () => ReturnType<typeof buildFsuPayload>;
}

let logCounter = 0;

const DCK_STORAGE_KEY = 'keon-emulator:deviceConnectionKey';

function loadPersistedDck(): string {
  try {
    const stored = globalThis.localStorage?.getItem(DCK_STORAGE_KEY);
    if (stored && /^[A-Z0-9]{8}$/.test(stored)) return stored;
  } catch {
    // Storage unavailable (private mode, SSR) — fall through to default.
  }
  return '';
}

function persistDck(key: string): void {
  try {
    if (key.length === 8) {
      globalThis.localStorage?.setItem(DCK_STORAGE_KEY, key);
    } else if (key.length === 0) {
      globalThis.localStorage?.removeItem(DCK_STORAGE_KEY);
    }
  } catch {
    // Best-effort: ignore storage errors.
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function buildEffectiveSpeed(speed: number, intensity: number): number {
  return clampPercent(speed) * speedIntensityToCoefficient(intensity);
}

function buildEffectiveMovementPosition(base: MovementCommandBase, strokerLevel: number): number {
  return scaleMovementTarget(
    base.fromPosition,
    base.targetPosition,
    rangeIntensityToCoefficient(strokerLevel),
  );
}

function buildEffectiveAnimationParams(
  base: AnimationParams,
  intensity: number,
  strokerLevel: number,
): AnimationParams {
  const range = scaleRangeAroundCenter(base.min, base.max, rangeIntensityToCoefficient(strokerLevel));
  return {
    ...range,
    speed: buildEffectiveSpeed(base.speed, intensity),
  };
}

export const useAppStore = create<AppState & AppActions>()((set, get) => ({
  // --- initial state ---
  deviceConnectionKey: loadPersistedDck(),
  accessToken: null,
  refreshToken: null,
  socketStatus: 'disconnected',

  position: 0,
  speed: 0,
  intensity: SPEED_INTENSITY_MAX,
  strokerLevel: RANGE_INTENSITY_MAX,
  battery: 100,

  movementCommandBase: null,
  movementBetweenBase: null,
  animationParams: null,
  logs: [],

  // --- actions ---
  setDeviceConnectionKey: (key) => {
    persistDck(key);
    set({ deviceConnectionKey: key });
  },

  setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),

  updateAccessToken: (access) => set({ accessToken: access }),

  setSocketStatus: (status) => set({ socketStatus: status }),

  setPosition: (position) => set({ position: clampPercent(position) }),

  applyMovementCommand: (speed, position) =>
    set((state) => {
      const base = { fromPosition: state.position, targetPosition: position, speed };
      return {
        speed: buildEffectiveSpeed(speed, state.intensity),
        position: buildEffectiveMovementPosition(base, state.strokerLevel),
        movementCommandBase: base,
        movementBetweenBase: null,
        animationParams: null,
      };
    }),

  applyMovementBetweenCommand: (speed, min, max) =>
    set((state) => {
      const base = { min, max, speed };
      const animationParams = buildEffectiveAnimationParams(base, state.intensity, state.strokerLevel);
      return {
        speed: animationParams.speed,
        movementCommandBase: null,
        movementBetweenBase: base,
        animationParams,
      };
    }),

  applyPauseCommand: () =>
    set({
      animationParams: null,
      movementCommandBase: null,
      movementBetweenBase: null,
      speed: 0,
    }),

  applySpeedIntensity: (intensity) =>
    set((state) => {
      if (state.movementBetweenBase) {
        const animationParams = buildEffectiveAnimationParams(
          state.movementBetweenBase,
          intensity,
          state.strokerLevel,
        );
        return { intensity, speed: animationParams.speed, animationParams };
      }

      if (state.movementCommandBase) {
        return {
          intensity,
          speed: buildEffectiveSpeed(state.movementCommandBase.speed, intensity),
        };
      }

      return { intensity };
    }),

  applyRangeIntensity: (intensity) =>
    set((state) => {
      if (state.movementBetweenBase) {
        const animationParams = buildEffectiveAnimationParams(
          state.movementBetweenBase,
          state.intensity,
          intensity,
        );
        return { strokerLevel: intensity, speed: animationParams.speed, animationParams };
      }

      if (state.movementCommandBase) {
        return {
          strokerLevel: intensity,
          position: buildEffectiveMovementPosition(state.movementCommandBase, intensity),
        };
      }

      return { strokerLevel: intensity };
    }),

  setBattery: (battery) => set({ battery: clampPercent(battery) }),

  addLog: (direction, event, data) => {
    const entry: LogEntry = {
      id: String(++logCounter),
      timestamp: Date.now(),
      direction,
      event,
      data,
    };
    set((state) => ({ logs: [...state.logs, entry] }));
  },

  clearLogs: () => set({ logs: [] }),

  buildDeviceStatus: () => {
    const s = get();
    const status: KeonDeviceStatus = {
      ble_address: DEVICE_CONSTANTS.BLE_ADDRESS,
      serial_number: DEVICE_CONSTANTS.SERIAL_NUMBER,
      battery_status: s.battery,
      status_package: DEVICE_CONSTANTS.STATUS_PACKAGE,
      encoder_pos: Math.round(s.position),
      motor_speed: Math.round(s.speed),
      wifi_strength: DEVICE_CONSTANTS.WIFI_STRENGTH,
      intensity: Math.round(s.intensity),
      stroker_level: Math.round(s.strokerLevel),
      firmware_version: DEVICE_CONSTANTS.FIRMWARE_VERSION,
      status_period: DEVICE_CONSTANTS.STATUS_PERIOD,
      error_code: DEVICE_CONSTANTS.ERROR_CODE,
    };
    return status;
  },

  buildFsuPayload: () => buildFsuPayload(get().buildDeviceStatus()),
}));
