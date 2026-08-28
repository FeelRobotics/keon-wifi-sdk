/// <reference types="web-bluetooth" />

import { KeonDeviceDriver } from './types';
import { keonProtocol } from './keonProtocol';

const NAME = 'ONYX ULTRA';

export const onix_ultra: KeonDeviceDriver = {
  name: NAME,
  matches: (device) => device.name === NAME,
  ble: {
    serviceUuid: 0x1400,
    motorCharUuid: 0x1801,
    batteryCharUuid: 0x2a19,
    maxPosition: 99,
    ...keonProtocol,
  },
};
