import { BleManager } from '../src/managers/BleManager';
import { KeonBLEError, KeonProvisioningError } from '../src/errors';
import * as utilsHelpers from '../src/utils/helpers';

const asciiDataView = (text: string): DataView => {
  const bytes = new Uint8Array(text.split('').map((c) => c.charCodeAt(0)));
  return new DataView(bytes.buffer);
};

const byteDataView = (...bytes: number[]): DataView =>
  new DataView(new Uint8Array(bytes).buffer);

interface FakeChar {
  writes: number[][];
  readQueue: DataView[];
  listeners: Record<string, (event: any) => void>;
  writeValue: jest.Mock;
  readValue: jest.Mock;
  startNotifications: jest.Mock;
  stopNotifications: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
}

const makeChar = (): FakeChar => {
  const char: FakeChar = {
    writes: [],
    readQueue: [],
    listeners: {},
    writeValue: jest.fn(),
    readValue: jest.fn(),
    startNotifications: jest.fn(),
    stopNotifications: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  char.writeValue.mockImplementation(async (value: Uint8Array) => {
    char.writes.push(Array.from(new Uint8Array(value)));
  });
  char.readValue.mockImplementation(
    async () => char.readQueue.shift() ?? byteDataView(0)
  );
  char.startNotifications.mockResolvedValue(char);
  char.stopNotifications.mockResolvedValue(char);
  char.addEventListener.mockImplementation((type: string, cb: any) => {
    char.listeners[type] = cb;
  });
  char.removeEventListener.mockImplementation((type: string) => {
    delete char.listeners[type];
  });
  return char;
};

const queueSuccessfulProvisioning = (char: FakeChar): void => {
  char.readQueue.push(
    byteDataView(17),
    byteDataView(17),
    byteDataView(17),
    byteDataView(17),
    byteDataView(17),
    byteDataView(16)
  );
};

const KEON2_CHARS = [0x1801, 0x2a19, 0x1901];
const KEON_WIFI_CHARS = [0x1800, 0x2a19, 0x2001, 0x1901, 0x1902, 0x1903];

function makeDevice(name: string, serviceUuid: number, charUuids: number[]) {
  const chars = new Map<number, FakeChar>();
  const deviceListeners: Record<string, (event: any) => void> = {};
  charUuids.forEach((uuid) => chars.set(uuid, makeChar()));

  const service = {
    getCharacteristic: jest.fn(async (uuid: number) => {
      const char = chars.get(uuid);
      if (!char) {
        throw new Error(`No characteristic ${uuid}`);
      }
      return char;
    }),
  };

  const disconnect = jest.fn();
  const device = {
    id: `${name}-id`,
    name,
    gatt: {
      connected: true,
      connect: jest.fn(async () => ({
        getPrimaryService: jest.fn(async (uuid: number) => {
          if (uuid !== serviceUuid) {
            throw new Error(`No service ${uuid}`);
          }
          return service;
        }),
      })),
      disconnect,
    },
    addEventListener: jest.fn((type: string, cb: any) => {
      deviceListeners[type] = cb;
    }),
    removeEventListener: jest.fn((type: string) => {
      delete deviceListeners[type];
    }),
  };

  return { device, chars, disconnect, deviceListeners };
}

function installNavigator(device: any) {
  (global as any).navigator = {
    bluetooth: { requestDevice: jest.fn().mockResolvedValue(device) },
  };
}

afterEach(() => jest.restoreAllMocks());

describe('BleManager.connect', () => {
  it('resolves a driver from the selected KEON2 device', async () => {
    const { device } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    installNavigator(device);

    const mgr = await BleManager.connect();

    expect(mgr.transport).toBe('ble');
    expect(mgr.deviceInfo.id).toBe('KEON2-id');
    // KEON2 has no info characteristics.
    expect(mgr.deviceInfo.firmwareVersion).toBeNull();
  });

  it('reads device info for KEON WIFI', async () => {
    const { device, chars } = makeDevice('KEON WIFI', 0x1900, KEON_WIFI_CHARS);
    chars.get(0x1901)!.readQueue.push(asciiDataView('2.0.0'));
    chars.get(0x1902)!.readQueue.push(asciiDataView('Kiiroo'));
    chars.get(0x1903)!.readQueue.push(asciiDataView('SN-001'));
    installNavigator(device);

    const mgr = await BleManager.connect();

    expect(mgr.deviceInfo).toMatchObject({
      firmwareVersion: '2.0.0',
      manufacturerName: 'Kiiroo',
      serialNumber: 'SN-001',
    });
  });

  it('throws KeonBLEError for an unsupported device', async () => {
    const { device } = makeDevice('HANDY', 0x1400, KEON2_CHARS);
    installNavigator(device);

    await expect(BleManager.connect()).rejects.toThrow(KeonBLEError);
  });

  it('throws KeonBLEError when Web Bluetooth is unavailable', async () => {
    (global as any).navigator = {};
    await expect(BleManager.connect()).rejects.toThrow(KeonBLEError);
  });
});

describe('BleManager control', () => {
  it('writes a clamped MOVEMENT for KEON2 (max 99)', async () => {
    const { device, chars } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    installNavigator(device);
    const mgr = await BleManager.connect();

    await mgr.moveTo(50, 80);

    expect(chars.get(0x1801)!.writes.at(-1)).toEqual([0x03, 0x01, 50, 80]);
  });

  it('clamps position to the KEON WIFI max (90)', async () => {
    const { device, chars } = makeDevice('KEON WIFI', 0x1900, KEON_WIFI_CHARS);
    installNavigator(device);
    const mgr = await BleManager.connect();

    await mgr.moveTo(50, 95);

    expect(chars.get(0x1800)!.writes.at(-1)).toEqual([0x03, 0x01, 50, 90]);
  });

  it('writes a PAUSE on stop', async () => {
    const { device, chars } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    installNavigator(device);
    const mgr = await BleManager.connect();

    await mgr.stop();

    expect(chars.get(0x1801)!.writes.at(-1)).toEqual([0x00]);
  });

  it('reads the battery level', async () => {
    const { device, chars } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    chars.get(0x2a19)!.readQueue.push(byteDataView(73));
    installNavigator(device);
    const mgr = await BleManager.connect();

    expect(await mgr.getBattery()).toBe(73);
  });

  it('delivers decoded position notifications', async () => {
    const { device, chars } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    installNavigator(device);
    const onPosition = jest.fn();
    await BleManager.connect({ onPosition });

    const listener =
      chars.get(0x1801)!.listeners['characteristicvaluechanged'];
    listener({ target: { value: byteDataView(0x00, 30) } });

    expect(onPosition).toHaveBeenCalledWith({ position: 70, speed: 0 });
  });

  it('removes the position notification listener on disconnect', async () => {
    const { device, chars } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    installNavigator(device);
    const mgr = await BleManager.connect();
    const motor = chars.get(0x1801)!;
    const [, listener] = motor.addEventListener.mock.calls.find(
      ([type]) => type === 'characteristicvaluechanged'
    )!;

    await mgr.disconnect();

    expect(motor.removeEventListener).toHaveBeenCalledWith(
      'characteristicvaluechanged',
      listener
    );
    expect(motor.listeners['characteristicvaluechanged']).toBeUndefined();
  });

  it('rejects out-of-range movement values', async () => {
    const { device } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    installNavigator(device);
    const mgr = await BleManager.connect();

    await expect(mgr.moveTo(101, 0)).rejects.toThrow(RangeError);
  });
});

describe('BleManager.provision', () => {
  it('runs the status-aware sequence for KEON2', async () => {
    jest.spyOn(utilsHelpers, 'wait').mockResolvedValue(undefined);
    const { device, chars } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    const prov = chars.get(0x1901)!;
    queueSuccessfulProvisioning(prov);
    installNavigator(device);
    const mgr = await BleManager.connect();

    await mgr.provision('SSID', 'pass', 'tok');

    // CLEAN_LIST, CHANGE_MODE_WIFI, START, then credential/token writes.
    expect(prov.writes[0]).toEqual([0x05]);
    expect(prov.writes[1]).toEqual([0x01]);
    expect(prov.writes[2]).toEqual([0x02]);
    expect(prov.readValue).toHaveBeenCalled();
  });

  it('emits SDK progress and device status events', async () => {
    const { device, chars } = makeDevice('KEON WIFI', 0x1900, KEON_WIFI_CHARS);
    const prov = chars.get(0x2001)!;
    queueSuccessfulProvisioning(prov);
    installNavigator(device);
    const mgr = await BleManager.connect();
    const onStatus = jest.fn();

    await mgr.provision('SSID', 'pass', 'tok', { onStatus });

    expect(prov.readValue).toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'clean-list',
        status: 'pending',
        source: 'sdk',
      })
    );
    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'cred-confirm',
        status: 'success',
        source: 'device-readback',
        code: 16,
        rawValue: [16],
      })
    );
  });

  it('throws when the device reports a failed status', async () => {
    const { device, chars } = makeDevice('KEON WIFI', 0x1900, KEON_WIFI_CHARS);
    chars.get(0x2001)!.readQueue.push(byteDataView(18));
    installNavigator(device);
    const mgr = await BleManager.connect();

    await expect(mgr.provision('SSID', 'pass', 'tok')).rejects.toThrow(
      KeonProvisioningError
    );
  });

  it('throws when a notification reports failure on a non-readback step', async () => {
    const { device, chars } = makeDevice('KEON WIFI', 0x1900, KEON_WIFI_CHARS);
    const prov = chars.get(0x2001)!;
    prov.readQueue.push(byteDataView(17), byteDataView(17), byteDataView(17));
    prov.writeValue.mockImplementation(async (value: Uint8Array) => {
      const bytes = Array.from(new Uint8Array(value));
      prov.writes.push(bytes);
      if (bytes[0] === '0'.charCodeAt(0)) {
        prov.listeners.characteristicvaluechanged?.({
          target: { value: byteDataView(18) },
        });
      }
    });
    installNavigator(device);
    const mgr = await BleManager.connect();

    await expect(mgr.provision('SSID', 'pass', 'tok')).rejects.toThrow(
      KeonProvisioningError
    );
  });

  it('can keep listening until the device disconnects after provisioning', async () => {
    const { device, chars, deviceListeners } = makeDevice(
      'KEON WIFI',
      0x1900,
      KEON_WIFI_CHARS
    );
    const prov = chars.get(0x2001)!;
    queueSuccessfulProvisioning(prov);
    prov.readValue.mockImplementation(async () => {
      const value = prov.readQueue.shift() ?? byteDataView(0);
      if (value.getUint8(0) === 16) {
        setTimeout(() => {
          device.gatt.connected = false;
          deviceListeners.gattserverdisconnected?.({ target: device });
        }, 0);
      }
      return value;
    });
    installNavigator(device);
    const mgr = await BleManager.connect();
    const onStatus = jest.fn();

    await expect(
      mgr.provision('SSID', 'pass', 'tok', {
        onStatus,
        postProvisionListenUntilDisconnect: true,
      })
    ).resolves.toBeUndefined();

    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'post-provision',
        status: 'pending',
        source: 'sdk',
      })
    );
    expect(prov.stopNotifications).toHaveBeenCalled();
  });

  it('rejects empty credentials', async () => {
    const { device } = makeDevice('KEON2', 0x1400, KEON2_CHARS);
    installNavigator(device);
    const mgr = await BleManager.connect();

    await expect(mgr.provision('', 'pass', 'tok')).rejects.toThrow(
      KeonProvisioningError
    );
  });
});
