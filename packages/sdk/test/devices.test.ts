import {
  DRIVERS,
  matchDriver,
  requestDeviceOptions,
} from '../src/devices';
import { keon2 } from '../src/devices/keon2';
import { keonWifi } from '../src/devices/keonWifi';

describe('device registry', () => {
  it('matches a selected device to its driver by name', () => {
    expect(matchDriver({ name: 'KEON2' } as BluetoothDevice)).toBe(keon2);
    expect(matchDriver({ name: 'KEON WIFI' } as BluetoothDevice)).toBe(
      keonWifi
    );
  });

  it('returns null for an unknown device', () => {
    expect(matchDriver({ name: 'HANDY' } as BluetoothDevice)).toBeNull();
  });

  it('builds request options covering every supported device', () => {
    const options = requestDeviceOptions() as {
      filters: { name: string }[];
      optionalServices: number[];
    };

    expect(options.filters).toEqual(DRIVERS.map((d) => ({ name: d.name })));
    expect(options.optionalServices).toEqual([0x1900, 0x1400]);
  });
});

describe('keon byte protocol', () => {
  it('encodes a MOVEMENT command', () => {
    expect(Array.from(keon2.ble.encodeMove(50, 80))).toEqual([
      0x03, 0x01, 50, 80,
    ]);
  });

  it('encodes a MOVEMENT_BETWEEN command', () => {
    expect(Array.from(keon2.ble.encodeMovementBetween(60, 10, 90))).toEqual([
      0x04, 0x00, 60, 10, 90,
    ]);
  });

  it('encodes a PAUSE command', () => {
    expect(Array.from(keon2.ble.encodePause())).toEqual([0x00]);
  });

  it('decodes a reversed position from byte[1]', () => {
    const value = new DataView(new Uint8Array([0x00, 30]).buffer);
    expect(keon2.ble.decodePosition(value)).toBe(70);
  });
});
