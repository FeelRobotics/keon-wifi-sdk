/// <reference types="web-bluetooth" />

import { KeonDeviceDriver } from './types';
import { keonProtocol } from './keonProtocol';

const NAME = 'KEON2';

/** Driver for the KEON2 device (BLE service 0x1400). */
export const keon2: KeonDeviceDriver = {
  name: NAME,
  matches: (device) => device.name === NAME,
  ble: {
    serviceUuid: 0x1400,
    motorCharUuid: 0x1801,
    batteryCharUuid: 0x2a19,
    provCharUuid: 0x1901,
    maxPosition: 99,
    provisioning: {
      mtu: 23,
      tokenChunkOverhead: 4,
      interPacketWaitMs: 100,
    },
    ...keonProtocol,
  },
};
