/// <reference types="web-bluetooth" />

import { transformDataToArray } from '../utils/helpers';

/**
 * The Keon motor byte protocol, shared by every current device generation
 * (KEON WIFI and KEON2 differ only in UUIDs/limits, not in the byte format).
 * A future device that diverges can supply its own encoders instead of these.
 */
export const keonProtocol = {
  encodeMove: (speed: number, position: number): Uint8Array<ArrayBuffer> =>
    transformDataToArray([0x03, 0x01, speed, position]),

  encodeMovementBetween: (
    speed: number,
    minPosition: number,
    maxPosition: number
  ): Uint8Array<ArrayBuffer> =>
    transformDataToArray([0x04, 0x00, speed, minPosition, maxPosition]),

  encodePause: (): Uint8Array<ArrayBuffer> => transformDataToArray([0x00]),

  encodeEnterMovementMode: (): Uint8Array<ArrayBuffer> =>
    transformDataToArray([0x00]),

  // The device reports a reversed position; byte[1] is the raw value.
  decodePosition: (value: DataView): number => 100 - value.getUint8(1),
};
