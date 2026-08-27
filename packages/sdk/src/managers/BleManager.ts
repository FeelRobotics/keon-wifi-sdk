/// <reference types="web-bluetooth" />

import {
  BleCallbacks,
  BleController,
  DeviceInfo,
  KeonBlePosition,
  KeonDeviceStatus,
} from '../core/types';
import { assertMovementValue } from '../core/validation';
import { KeonDeviceDriver } from '../devices/types';
import { matchDriver, requestDeviceOptions } from '../devices';
import { KeonBLEError } from '../errors';
import { dataViewToAsciiString, wait } from '../utils/helpers';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

/**
 * Direct Bluetooth LE transport. Drives the motor over the device's native byte
 * protocol. The concrete device generation (UUIDs, limits) is supplied by a
 * {@link KeonDeviceDriver} resolved from the device the user picks in the
 * browser dialog.
 *
 * Browser-only — relies on `navigator.bluetooth`.
 */
export class BleManager implements BleController {
  readonly transport = 'ble' as const;

  private positionCallback?: (position: KeonBlePosition) => void;
  private positionListener?: (event: Event) => void;

  private constructor(
    private readonly device: BluetoothDevice,
    private readonly driver: KeonDeviceDriver,
    private readonly motorChar: BluetoothRemoteGATTCharacteristic,
    private readonly batteryChar: BluetoothRemoteGATTCharacteristic | null,
    public readonly deviceInfo: DeviceInfo
  ) {}

  /**
   * Prompts the user to pick a device, connects over GATT, reads device info,
   * enters movement mode and subscribes to motor position notifications.
   */
  static async connect(options: BleCallbacks = {}): Promise<BleManager> {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      throw new KeonBLEError(
        'Web Bluetooth is not available in this environment'
      );
    }

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice(requestDeviceOptions());
    } catch (error) {
      throw new KeonBLEError('Failed to select a Bluetooth device', {
        cause: error,
      });
    }

    const driver = matchDriver(device);
    if (!driver) {
      throw new KeonBLEError(`Unsupported device: ${device.name ?? 'unknown'}`);
    }

    let service: BluetoothRemoteGATTService;
    let motorChar: BluetoothRemoteGATTCharacteristic;
    let batteryChar: BluetoothRemoteGATTCharacteristic | null = null;
    let deviceInfo: DeviceInfo;
    try {
      if (!device.gatt) {
        throw new Error('Device has no GATT server');
      }
      const server = await device.gatt.connect();
      service = await server.getPrimaryService(driver.ble.serviceUuid);
      motorChar = await service.getCharacteristic(driver.ble.motorCharUuid);
      try {
        batteryChar = await service.getCharacteristic(
          driver.ble.batteryCharUuid
        );
      } catch {
        batteryChar = null;
      }
      deviceInfo = await BleManager.readDeviceInfo(device, service, driver);
    } catch (error) {
      throw new KeonBLEError('Failed to connect to the device', {
        cause: error,
      });
    }

    const manager = new BleManager(
      device,
      driver,
      motorChar,
      batteryChar,
      deviceInfo
    );
    if (options.onPosition) {
      manager.positionCallback = options.onPosition;
    }
    await manager.enterMovementMode();
    return manager;
  }

  private static async readDeviceInfo(
    device: BluetoothDevice,
    service: BluetoothRemoteGATTService,
    driver: KeonDeviceDriver
  ): Promise<DeviceInfo> {
    const info: DeviceInfo = {
      id: device.id,
      name: device.name,
      firmwareVersion: null,
      manufacturerName: null,
      serialNumber: null,
    };
    const chars = driver.ble.infoChars;
    if (!chars) {
      return info;
    }
    const read = async (uuid?: number): Promise<string | null> => {
      if (uuid === undefined) {
        return null;
      }
      try {
        const characteristic = await service.getCharacteristic(uuid);
        return dataViewToAsciiString(await characteristic.readValue());
      } catch {
        return null;
      }
    };
    info.firmwareVersion = await read(chars.firmware);
    info.manufacturerName = await read(chars.manufacturer);
    info.serialNumber = await read(chars.serial);
    return info;
  }

  private async enterMovementMode(): Promise<void> {
    try {
      await this.motorChar.writeValue(
        this.driver.ble.encodeEnterMovementMode()
      );
      await this.motorChar.startNotifications();
      // Keep a reference so disconnect() can remove the listener again.
      const listener = (event: Event): void => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) {
          return;
        }
        const position = this.driver.ble.decodePosition(value);
        this.positionCallback?.({ position, speed: 0 });
      };
      this.positionListener = listener;
      this.motorChar.addEventListener('characteristicvaluechanged', listener);
    } catch {
      // The device may reject movement-mode setup; motor control and position
      // notifications then stay unavailable, but the connection itself is fine.
    }
  }

  onPosition(callback: (position: KeonBlePosition) => void): void {
    this.positionCallback = callback;
  }

  get driverName(): string {
    return this.driver.name;
  }

  isConnected(): boolean {
    return !!this.device.gatt?.connected;
  }

  getStatus(): KeonDeviceStatus | null {
    // BLE exposes battery via getBattery() and position via onPosition();
    // there is no full status frame as on the remote transports.
    return null;
  }

  async moveTo(speed: number, position: number): Promise<void> {
    assertMovementValue('speed', speed);
    assertMovementValue('position', position);
    const spd = clamp(speed, 0, 99);
    const pos = clamp(position, 0, this.driver.ble.maxPosition);
    await this.motorChar.writeValue(this.driver.ble.encodeMove(spd, pos));
  }

  async movementBetween(
    speed: number,
    minPosition: number,
    maxPosition: number
  ): Promise<void> {
    assertMovementValue('speed', speed);
    assertMovementValue('minPosition', minPosition);
    assertMovementValue('maxPosition', maxPosition);
    const spd = clamp(speed, 0, 99);
    const min = clamp(minPosition, 0, this.driver.ble.maxPosition);
    const max = clamp(maxPosition, 0, this.driver.ble.maxPosition);
    await this.motorChar.writeValue(
      this.driver.ble.encodeMovementBetween(spd, min, max)
    );
  }

  async stop(): Promise<void> {
    await this.motorChar.writeValue(this.driver.ble.encodePause());
  }

  async getBattery(): Promise<number> {
    if (!this.batteryChar) {
      return -1;
    }
    try {
      return (await this.batteryChar.readValue()).getUint8(0);
    } catch {
      return -1;
    }
  }

  async testDevice(): Promise<void> {
    await this.movementBetween(50, 10, 90);
    await wait(2000);
    await this.stop();
  }

  async disconnect(): Promise<void> {
    if (this.positionListener) {
      this.motorChar.removeEventListener(
        'characteristicvaluechanged',
        this.positionListener
      );
      this.positionListener = undefined;
    }
    try {
      await this.motorChar.stopNotifications();
    } catch {
      // ignore — notifications may never have started
    }
    this.device.gatt?.disconnect();
  }
}
