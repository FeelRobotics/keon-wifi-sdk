/// <reference types="web-bluetooth" />

import {
  BleCallbacks,
  BleController,
  DeviceInfo,
  KeonBlePosition,
  KeonDeviceStatus,
  KeonProvisioningEvent,
  KeonProvisioningOptions,
  KeonProvisioningStage,
  KeonProvisioningStatus,
} from '../core/types';
import { assertMovementValue } from '../core/validation';
import { KeonDeviceDriver } from '../devices/types';
import { matchDriver, requestDeviceOptions } from '../devices';
import { KeonBLEError, KeonProvisioningError } from '../errors';
import {
  dataViewToAsciiString,
  transformDataToArray,
  wait,
} from '../utils/helpers';

// Provisioning control bytes — shared across device generations.
const PROV_CHANGE_MODE_WIFI = 0x1;
const PROV_START = 0x2;
const PROV_CRED_CONFIRM = 0x3;
const PROV_CLEAN_LIST = 0x5;
const PROV_SUCCESS_STATUS = 16;
const PROV_ONGOING_STATUS = 17;
const PROV_FAIL_STATUS = 18;

const PREFIX_SSID = '0';
const PREFIX_PASSWORD = '1';
const PREFIX_TOKEN = '2';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const STAGE_MESSAGES: Record<KeonProvisioningStage, string> = {
  'clean-list': 'Cleaning stored WiFi provisioning data',
  'change-mode-wifi': 'Switching the device to WiFi provisioning mode',
  start: 'Preparing the device for provisioning',
  ssid: 'Writing WiFi SSID',
  password: 'Writing WiFi password',
  token: 'Writing registration token',
  'cred-confirm': 'Confirming credentials and starting WiFi connection',
  'post-provision': 'Listening for late BLE provisioning messages',
};

const decodeProvisioningStatus = (
  code: number
): { status: KeonProvisioningStatus; message: string } => {
  switch (code) {
    case PROV_SUCCESS_STATUS:
      return {
        status: 'success',
        message: 'Device reported provisioning success',
      };
    case PROV_ONGOING_STATUS:
      return {
        status: 'ongoing',
        message: 'Device reported provisioning in progress',
      };
    case PROV_FAIL_STATUS:
      return {
        status: 'failed',
        message: 'Device reported provisioning failure',
      };
    default:
      return {
        status: 'unknown',
        message: `Device reported unknown provisioning status ${code}`,
      };
  }
};

const dataViewToBytes = (value: DataView): number[] =>
  Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));

const isExpectedProvisioningStatus = (
  status: KeonProvisioningStatus,
  expected: KeonProvisioningStatus
): boolean => status === expected;

/**
 * Direct Bluetooth LE transport. Provisions WiFi credentials and drives the
 * motor over the device's native byte protocol. The concrete device generation
 * (UUIDs, limits, provisioning timing) is supplied by a {@link KeonDeviceDriver}
 * resolved from the device the user picks in the browser dialog.
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
    private readonly service: BluetoothRemoteGATTService,
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
      service,
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
      // The device may reject movement-mode setup (e.g. when only provisioning);
      // control/notifications then stay unavailable but provisioning still works.
    }
  }

  onPosition(callback: (position: KeonBlePosition) => void): void {
    this.positionCallback = callback;
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

  async provision(
    ssid: string,
    password: string,
    token: string,
    options: KeonProvisioningOptions = {}
  ): Promise<void> {
    if (!this.isConnected()) {
      throw new KeonProvisioningError('The device should be connected first');
    }
    if (!ssid || !password || !token) {
      throw new KeonProvisioningError('ssid, password and token are required');
    }

    const { mtu, tokenChunkOverhead, interPacketWaitMs } =
      this.driver.ble.provisioning;
    const provChar = await this.service.getCharacteristic(
      this.driver.ble.provCharUuid
    );

    let currentStage: KeonProvisioningStage = 'clean-list';
    let notificationsStarted = false;
    let notificationFailure: KeonProvisioningError | null = null;
    let finalStatusEvent: KeonProvisioningEvent | null = null;
    const finalStatusResolver: {
      current: ((event: KeonProvisioningEvent | null) => void) | null;
    } = { current: null };

    const emit = (event: KeonProvisioningEvent): void => {
      options.onStatus?.(event);
    };

    const emitSdkProgress = (
      stage: KeonProvisioningStage,
      chunkIndex?: number,
      chunkTotal?: number
    ): void => {
      emit({
        stage,
        status: 'pending',
        source: 'sdk',
        message:
          stage === 'token' && chunkIndex && chunkTotal
            ? `${STAGE_MESSAGES[stage]} (${chunkIndex}/${chunkTotal})`
            : STAGE_MESSAGES[stage],
        chunkIndex,
        chunkTotal,
      });
    };

    const emitDeviceStatus = (
      stage: KeonProvisioningStage,
      value: DataView,
      source: 'device-readback' | 'device-notification'
    ): KeonProvisioningEvent => {
      const rawValue = dataViewToBytes(value);
      const code = rawValue[0] ?? 0;
      const decoded = decodeProvisioningStatus(code);
      const event: KeonProvisioningEvent = {
        stage,
        status: decoded.status,
        source,
        message: decoded.message,
        code,
        rawValue,
      };
      emit(event);
      return event;
    };

    const ensureDeviceStatus = (
      event: KeonProvisioningEvent,
      expected: KeonProvisioningStatus
    ): void => {
      if (event.status === 'failed') {
        throw new KeonProvisioningError(
          `${STAGE_MESSAGES[event.stage]} failed: ${event.message}`
        );
      }
      if (!isExpectedProvisioningStatus(event.status, expected)) {
        throw new KeonProvisioningError(
          `Unexpected provisioning status ${event.code ?? 'unknown'} at ` +
            `${event.stage}: expected ${expected}, got ${event.status}`
        );
      }
    };

    const errorFromFailedDeviceStatus = (
      event: KeonProvisioningEvent
    ): KeonProvisioningError | null => {
      if (event.status !== 'failed') {
        return null;
      }
      return new KeonProvisioningError(
        `${STAGE_MESSAGES[event.stage]} failed: ${event.message}`
      );
    };

    const throwIfNotificationFailed = (): void => {
      if (notificationFailure) {
        throw notificationFailure;
      }
    };

    const readDeviceStatus = async (
      stage: KeonProvisioningStage
    ): Promise<KeonProvisioningEvent | null> => {
      let value: DataView;
      try {
        value = await provChar.readValue();
      } catch {
        return null;
      }
      return emitDeviceStatus(stage, value, 'device-readback');
    };

    const readback = async (
      stage: KeonProvisioningStage,
      expected: KeonProvisioningStatus
    ): Promise<boolean> => {
      const event = await readDeviceStatus(stage);
      if (!event) {
        return false;
      }
      ensureDeviceStatus(event, expected);
      return true;
    };

    const waitForFinalStatus = async (
      timeoutMs: number
    ): Promise<KeonProvisioningEvent | null> => {
      if (finalStatusEvent || !notificationsStarted || timeoutMs <= 0) {
        return finalStatusEvent;
      }
      return await new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (finalStatusResolver.current) {
            finalStatusResolver.current = null;
            resolve(null);
          }
        }, timeoutMs);
        finalStatusResolver.current = (event) => {
          clearTimeout(timer);
          finalStatusResolver.current = null;
          resolve(event);
        };
      });
    };

    const waitForDeviceDisconnect = async (): Promise<void> => {
      if (!this.isConnected()) {
        return;
      }
      await new Promise<void>((resolve) => {
        const handleDisconnect = (): void => {
          this.device.removeEventListener(
            'gattserverdisconnected',
            handleDisconnect
          );
          resolve();
        };

        this.device.addEventListener(
          'gattserverdisconnected',
          handleDisconnect
        );
        if (!this.isConnected()) {
          handleDisconnect();
        }
      });
    };

    const listenAfterProvision = async (): Promise<void> => {
      if (!notificationsStarted) {
        return;
      }

      const listenUntilDisconnect =
        options.postProvisionListenUntilDisconnect ?? false;
      const listenMs = options.postProvisionListenMs ?? 0;
      if (!listenUntilDisconnect && listenMs <= 0) {
        return;
      }

      currentStage = 'post-provision';
      emit({
        stage: 'post-provision',
        status: 'pending',
        source: 'sdk',
        message: listenUntilDisconnect
          ? 'Listening for late BLE messages until device disconnects'
          : `Listening for late BLE messages for ${listenMs} ms`,
      });

      if (listenUntilDisconnect) {
        await waitForDeviceDisconnect();
      } else {
        await wait(listenMs);
      }
      throwIfNotificationFailed();
    };

    const write = async (
      data: number[] | string,
      stage: KeonProvisioningStage,
      expectedStatus: KeonProvisioningStatus | null,
      chunkIndex?: number,
      chunkTotal?: number
    ): Promise<void> => {
      currentStage = stage;
      emitSdkProgress(stage, chunkIndex, chunkTotal);
      await provChar.writeValue(transformDataToArray(data));
      const didReadback = expectedStatus
        ? await readback(stage, expectedStatus)
        : false;
      if (!didReadback && interPacketWaitMs) {
        await wait(interPacketWaitMs);
      }
      throwIfNotificationFailed();
    };

    const handleStatusNotification = (event: Event): void => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (value) {
        const statusEvent = emitDeviceStatus(
          currentStage,
          value,
          'device-notification'
        );
        if (
          currentStage === 'cred-confirm' &&
          (statusEvent.status === 'success' || statusEvent.status === 'failed')
        ) {
          finalStatusEvent = statusEvent;
          finalStatusResolver.current?.(statusEvent);
        }
        notificationFailure =
          notificationFailure ?? errorFromFailedDeviceStatus(statusEvent);
      }
    };

    const confirmCredentials = async (): Promise<void> => {
      currentStage = 'cred-confirm';
      emitSdkProgress('cred-confirm');
      await provChar.writeValue(transformDataToArray([PROV_CRED_CONFIRM]));

      const event = await readDeviceStatus('cred-confirm');
      if (event) {
        if (event.status === 'success') {
          return;
        }
        if (event.status === 'failed' || event.status === 'unknown') {
          ensureDeviceStatus(event, 'success');
        }
      }

      const finalEvent = await waitForFinalStatus(
        options.finalStatusTimeoutMs ?? 0
      );
      if (finalEvent) {
        ensureDeviceStatus(finalEvent, 'success');
        return;
      }

      if (options.finalStatusTimeoutMs && notificationsStarted) {
        emit({
          stage: 'cred-confirm',
          status: 'unknown',
          source: 'sdk',
          message:
            'No final BLE provisioning status was received before timeout',
        });
      } else if (!event && interPacketWaitMs) {
        await wait(interPacketWaitMs);
      }
      throwIfNotificationFailed();
    };

    try {
      try {
        await provChar.startNotifications();
        provChar.addEventListener(
          'characteristicvaluechanged',
          handleStatusNotification
        );
        notificationsStarted = true;
      } catch {
        // Some clients/devices may allow readback but reject notifications.
      }

      await write([PROV_CLEAN_LIST], 'clean-list', 'ongoing');
      await write([PROV_CHANGE_MODE_WIFI], 'change-mode-wifi', 'ongoing');
      await write([PROV_START], 'start', 'ongoing');
      await write(PREFIX_SSID + ssid, 'ssid', null);
      await write(PREFIX_PASSWORD + password, 'password', 'ongoing');

      const packetSize = mtu - tokenChunkOverhead;
      const chunkTotal = Math.ceil(token.length / packetSize);
      for (let i = 0; i < token.length; i += packetSize) {
        await write(
          PREFIX_TOKEN + token.slice(i, i + packetSize),
          'token',
          null,
          Math.floor(i / packetSize) + 1,
          chunkTotal
        );
      }
      const didReadTokenStatus = await readback('token', 'ongoing');
      if (!didReadTokenStatus && interPacketWaitMs) {
        await wait(interPacketWaitMs);
      }
      throwIfNotificationFailed();

      await confirmCredentials();
      await listenAfterProvision();
    } finally {
      const pendingFinalStatus = finalStatusResolver.current;
      finalStatusResolver.current = null;
      if (pendingFinalStatus) {
        pendingFinalStatus(null);
      }
      if (notificationsStarted) {
        provChar.removeEventListener(
          'characteristicvaluechanged',
          handleStatusNotification
        );
        try {
          await provChar.stopNotifications();
        } catch {
          // ignore — the device may already have stopped notifications
        }
      }
    }
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
