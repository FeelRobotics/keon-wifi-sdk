/// <reference types="web-bluetooth" />

import { KeonDeviceDriver } from './types';
import { keonProtocol } from './keonProtocol';

const NAME = 'KEON WIFI';

/** Driver for the original KEON WIFI device (BLE service 0x1900). */
export const keonWifi: KeonDeviceDriver = {
  name: NAME,
  matches: (device) => device.name === NAME,
  ble: {
    serviceUuid: 0x1900,
    motorCharUuid: 0x1800,
    batteryCharUuid: 0x2a19,
    provCharUuid: 0x2001,
    infoChars: { firmware: 0x1901, manufacturer: 0x1902, serial: 0x1903 },
    maxPosition: 90,
    provisioning: {
      mtu: 512,
      tokenChunkOverhead: 12,
      interPacketWaitMs: 0,
    },
    ...keonProtocol,
  },
};
