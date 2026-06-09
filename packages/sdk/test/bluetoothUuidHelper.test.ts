import {
  toFullUUID,
  fromFullUUID,
} from '../src/utils/bluetooth-uuid-helper';

describe('toFullUUID', () => {
  it('converts a 16-bit UUID to Bluetooth namespace format', () => {
    expect(toFullUUID(0x2a19)).toBe('00002a19-0000-1000-8000-00805f9b34fb');
  });

  it('pads values with leading zeros to fill 4 hex digits', () => {
    expect(toFullUUID(0x0001)).toBe('00000001-0000-1000-8000-00805f9b34fb');
  });

  it('handles the maximum 16-bit value 0xffff', () => {
    expect(toFullUUID(0xffff)).toBe('0000ffff-0000-1000-8000-00805f9b34fb');
  });

  it('handles the SDK primary service UUID 0x1900', () => {
    expect(toFullUUID(0x1900)).toBe('00001900-0000-1000-8000-00805f9b34fb');
  });

  it('handles the SDK provisioning characteristic UUID 0x2001', () => {
    expect(toFullUUID(0x2001)).toBe('00002001-0000-1000-8000-00805f9b34fb');
  });
});

describe('fromFullUUID', () => {
  it('extracts the 16-bit value from a full Bluetooth UUID', () => {
    expect(fromFullUUID('00002a19-0000-1000-8000-00805f9b34fb')).toBe(0x2a19);
  });

  it('extracts service UUIDs correctly', () => {
    expect(fromFullUUID('00001900-0000-1000-8000-00805f9b34fb')).toBe(0x1900);
  });

  it('round-trips with toFullUUID', () => {
    const originals = [0x2a19, 0x1900, 0x2001, 0xffff, 0x0001];
    originals.forEach(uuid =>
      expect(fromFullUUID(toFullUUID(uuid))).toBe(uuid)
    );
  });
});
