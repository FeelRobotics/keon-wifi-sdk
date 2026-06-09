/// <reference types="web-bluetooth" />

import { KeonDeviceDriver } from './types';
import { keonWifi } from './keonWifi';
import { keon2 } from './keon2';

/**
 * The set of supported devices. Add a device: create its driver file and add it
 * here. Remove a device: delete its file and its entry below.
 */
export const DRIVERS: KeonDeviceDriver[] = [keonWifi, keon2];

/** Finds the driver for an already-selected Bluetooth device, or null. */
export function matchDriver(device: BluetoothDevice): KeonDeviceDriver | null {
  return DRIVERS.find((driver) => driver.matches(device)) ?? null;
}

/** Builds the Web Bluetooth request filter covering every supported device. */
export function requestDeviceOptions(): RequestDeviceOptions {
  return {
    filters: DRIVERS.map((driver) => ({ name: driver.name })),
    optionalServices: DRIVERS.map((driver) => driver.ble.serviceUuid),
  };
}

export type { KeonDeviceDriver } from './types';
