import {
  KeonDeviceStatus,
  KeonTransport,
  RemoteCallbacks,
  RemoteController,
} from '../core/types';
import {
  assertMovementValue,
  assertSettingsValue,
  assertStatusIntervalValue,
} from '../core/validation';
import * as codec from '../core/commandCodec';
import { RemoteMessage } from '../core/commandCodec';
import { wait } from '../utils/helpers';

const DEFAULT_COMMAND_INTERVAL_MS = 200;

/**
 * Shared base for the server-backed transports. The command vocabulary is
 * identical across WiFi (Socket.IO) and FUG (REST); subclasses only implement
 * how a {@link RemoteMessage} is delivered and how the connection is torn down.
 */
export abstract class RemoteManager implements RemoteController {
  abstract readonly transport: KeonTransport;

  protected deviceStatuses: KeonDeviceStatus[] = [];
  protected onStatusChange?: (statuses: KeonDeviceStatus[]) => void;
  protected onUserAction?: (message: unknown) => void;
  protected onError?: (error: Error) => void;

  protected constructor(callbacks: RemoteCallbacks = {}) {
    this.onStatusChange = callbacks.onStatusChange;
    this.onUserAction = callbacks.onUserAction;
    this.onError = callbacks.onError;
  }

  /** Delivers a command to the device. */
  protected abstract send(message: RemoteMessage): Promise<void>;

  /**
   * Unwraps a device-model-keyed status object — `{ KEON: {...} }` or
   * `{ KEON2: {...} }` — into the inner status, or null when it isn't one.
   */
  protected unwrapStatus(wrapper: unknown): KeonDeviceStatus | null {
    if (!wrapper || typeof wrapper !== 'object') return null;
    const inner =
      (wrapper as Record<string, unknown>).KEON2 ??
      (wrapper as Record<string, unknown>).KEON ??
      null;
    return inner && typeof inner === 'object'
      ? (inner as KeonDeviceStatus)
      : null;
  }

  /** Normalizes a thrown value into an Error and notifies the consumer. */
  protected emitError(error: unknown): void {
    this.onError?.(error instanceof Error ? error : new Error(String(error)));
  }

  /** Replaces the full set of device statuses and notifies the consumer. */
  protected setStatuses(statuses: KeonDeviceStatus[]): void {
    this.deviceStatuses = statuses;
    this.onStatusChange?.(this.deviceStatuses);
  }

  /** Merges one device's status into the set (keyed by serial) and notifies. */
  protected upsertStatus(status: KeonDeviceStatus): void {
    const idx = this.deviceStatuses.findIndex(
      (s) => s.serial_number === status.serial_number
    );
    this.deviceStatuses =
      idx >= 0
        ? this.deviceStatuses.map((s, i) => (i === idx ? status : s))
        : [...this.deviceStatuses, status];
    this.onStatusChange?.(this.deviceStatuses);
  }

  async moveTo(speed: number, position: number): Promise<void> {
    assertMovementValue('speed', speed);
    assertMovementValue('position', position);
    await this.send(codec.move(speed, position));
  }

  async movementBetween(
    speed: number,
    minPosition: number,
    maxPosition: number
  ): Promise<void> {
    assertMovementValue('speed', speed);
    assertMovementValue('minPosition', minPosition);
    assertMovementValue('maxPosition', maxPosition);
    await this.send(codec.movementBetween(speed, minPosition, maxPosition));
  }

  async stop(): Promise<void> {
    await this.send(codec.pause());
  }

  async setIntensity(intensity: number): Promise<void> {
    assertSettingsValue('intensity', intensity);
    // Map a 0..100 percentage to the device's speed (1..8) and range (1..4)
    // intensity steps — same recalculation FeelmePortal's KeonWiFi wrapper uses.
    const speedIntensity = Math.min(8, Math.floor((intensity / 100) * 8) + 1);
    const rangeIntensity = Math.min(4, Math.floor((intensity / 100) * 4) + 1);
    await this.send(codec.speedIntensity(speedIntensity));
    await wait(DEFAULT_COMMAND_INTERVAL_MS);
    await this.send(codec.rangeIntensity(rangeIntensity));
  }

  async setStatusInterval(interval: number): Promise<void> {
    assertStatusIntervalValue('interval', interval);
    await this.send(codec.statusInterval(interval));
  }

  async switchToBtMode(): Promise<void> {
    await this.send(codec.reprovision('bt_mode'));
  }

  async resetCredentials(): Promise<void> {
    await this.send(codec.reprovision('reset_credentials'));
  }

  async forceStatusReport(): Promise<void> {
    await this.send(codec.getStatus());
  }

  getStatus(): KeonDeviceStatus | null {
    return this.deviceStatuses[0] ?? null;
  }

  getStatuses(): KeonDeviceStatus[] {
    return this.deviceStatuses;
  }

  abstract disconnect(): Promise<void>;
}
