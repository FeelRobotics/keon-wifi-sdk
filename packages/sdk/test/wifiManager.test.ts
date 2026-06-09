import { WifiManager } from '../src/managers/WifiManager';
import { AuthError } from '../src/errors';
import * as socketModule from '../src/api/socketio-client';
import * as helpers from '../src/api/helpers';
import * as utilsHelpers from '../src/utils/helpers';

describe('WifiManager', () => {
  let sendMessage: jest.Mock;
  let close: jest.Mock;
  let captured: any;

  beforeEach(() => {
    sendMessage = jest.fn();
    close = jest.fn();
    captured = null;
    jest
      .spyOn(helpers, 'getCredentialForFecServer')
      .mockResolvedValue(['wss://x', 'access-tok']);
    jest
      .spyOn(socketModule, 'socketIOClient')
      .mockImplementation(async (opts: any) => {
        captured = opts;
        return { sendMessage, close, isConnected: () => true } as any;
      });
  });

  afterEach(() => jest.restoreAllMocks());

  const connect = () => WifiManager.connect('feel-tok', 'reg-tok');

  it('exchanges tokens for socket credentials on connect', async () => {
    await connect();

    expect(helpers.getCredentialForFecServer).toHaveBeenCalledWith(
      'feel-tok',
      'reg-tok'
    );
    expect(captured.serverUrl).toBe('wss://x');
    expect(captured.token).toBe('access-tok');
  });

  it('throws AuthError when credentials are missing', async () => {
    jest
      .spyOn(helpers, 'getCredentialForFecServer')
      .mockResolvedValue([null, null]);

    await expect(connect()).rejects.toThrow(AuthError);
  });

  it('invokes onStatusChange with a list when a KEON status arrives', async () => {
    const onStatusChange = jest.fn();
    const mgr = await WifiManager.connect('t', 'r', { onStatusChange });

    captured.onDeviceStatus({ payload: { KEON: { battery_status: 80 } } });

    expect(onStatusChange).toHaveBeenCalledWith([{ battery_status: 80 }]);
    expect(mgr.getStatus()).toEqual({ battery_status: 80 });
  });

  it('unwraps a KEON2 status as well', async () => {
    const onStatusChange = jest.fn();
    const mgr = await WifiManager.connect('t', 'r', { onStatusChange });

    captured.onDeviceStatus({ payload: { KEON2: { battery_status: 70 } } });

    expect(mgr.getStatus()).toEqual({ battery_status: 70 });
  });

  it('accumulates statuses from multiple devices by serial', async () => {
    const onStatusChange = jest.fn();
    const mgr = await WifiManager.connect('t', 'r', { onStatusChange });

    captured.onDeviceStatus({ payload: { KEON: { serial_number: 'A' } } });
    captured.onDeviceStatus({ payload: { KEON2: { serial_number: 'B' } } });
    captured.onDeviceStatus({
      payload: { KEON: { serial_number: 'A', battery_status: 50 } },
    });

    expect(mgr.getStatuses()).toEqual([
      { serial_number: 'A', battery_status: 50 },
      { serial_number: 'B' },
    ]);
  });

  it('skips callback for payloads without a device status', async () => {
    const onStatusChange = jest.fn();
    const mgr = await WifiManager.connect('t', 'r', { onStatusChange });

    captured.onDeviceStatus({ foo: 'bar' });

    expect(onStatusChange).not.toHaveBeenCalled();
    expect(mgr.getStatus()).toBeNull();
  });

  it('routes user activity to onUserAction', async () => {
    const onUserAction = jest.fn();
    await WifiManager.connect('t', 'r', { onUserAction });

    captured.onUserActivity({ hello: 1 });

    expect(onUserAction).toHaveBeenCalledWith({ hello: 1 });
  });

  it('emits a MOVEMENT command via moveTo', async () => {
    const mgr = await connect();

    await mgr.moveTo(50, 90);

    expect(sendMessage).toHaveBeenCalledWith('send_command_to_devices', {
      command_type: 'MOVEMENT',
      arguments: { speed: 50, position: 90 },
    });
  });

  it('emits a MOVEMENT_BETWEEN command via movementBetween', async () => {
    const mgr = await connect();

    await mgr.movementBetween(60, 10, 90);

    expect(sendMessage).toHaveBeenCalledWith('send_command_to_devices', {
      command_type: 'MOVEMENT_BETWEEN',
      arguments: { speed: 60, min_position: 10, max_position: 90 },
    });
  });

  it('emits a PAUSE command via stop', async () => {
    const mgr = await connect();

    await mgr.stop();

    expect(sendMessage).toHaveBeenCalledWith('send_command_to_devices', {
      command_type: 'PAUSE',
      arguments: {},
    });
  });

  it('rejects non-integer and out-of-range movement values', async () => {
    const mgr = await connect();

    await expect(mgr.moveTo(50.5, 90)).rejects.toThrow(RangeError);
    await expect(mgr.movementBetween(50, -1, 100)).rejects.toThrow(RangeError);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('emits two settings messages via setIntensity', async () => {
    jest.spyOn(utilsHelpers, 'wait').mockResolvedValue(undefined);
    const mgr = await connect();

    await mgr.setIntensity(100);

    expect(sendMessage).toHaveBeenNthCalledWith(1, 'send_settings_to_device', {
      setup_type: 'speed_intensity_adjustment',
      arguments: { intensity: 8 },
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'send_settings_to_device', {
      setup_type: 'range_intensity_adjustment',
      arguments: { intensity: 4 },
    });
  });

  it('maps a mid-range intensity percentage to device steps', async () => {
    jest.spyOn(utilsHelpers, 'wait').mockResolvedValue(undefined);
    const mgr = await connect();

    await mgr.setIntensity(50);

    expect(sendMessage).toHaveBeenNthCalledWith(1, 'send_settings_to_device', {
      setup_type: 'speed_intensity_adjustment',
      arguments: { intensity: 5 },
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'send_settings_to_device', {
      setup_type: 'range_intensity_adjustment',
      arguments: { intensity: 3 },
    });
  });

  it('rejects intensity values outside 0-100', async () => {
    const mgr = await connect();

    await expect(mgr.setIntensity(101)).rejects.toThrow(RangeError);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('emits a status_update_interval setting via setStatusInterval', async () => {
    const mgr = await connect();

    await mgr.setStatusInterval(3);

    expect(sendMessage).toHaveBeenCalledWith('send_settings_to_device', {
      setup_type: 'status_update_interval',
      arguments: { interval: 3 },
    });
  });

  it('rejects status interval values outside 0-1000', async () => {
    const mgr = await connect();

    await expect(mgr.setStatusInterval(1001)).rejects.toThrow(RangeError);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('emits get_status_of_devices via forceStatusReport', async () => {
    const mgr = await connect();

    await mgr.forceStatusReport();

    expect(sendMessage).toHaveBeenCalledWith('get_status_of_devices', {});
  });

  it('emits reprovision commands', async () => {
    const mgr = await connect();

    await mgr.switchToBtMode();
    await mgr.resetCredentials();

    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      'send_reprovision_command_to_device',
      { reprovision_type: 'bt_mode', arguments: {} }
    );
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      'send_reprovision_command_to_device',
      { reprovision_type: 'reset_credentials', arguments: {} }
    );
  });

  it('closes the underlying socket on disconnect', async () => {
    const mgr = await connect();

    await mgr.disconnect();

    expect(close).toHaveBeenCalled();
  });

  it('reports its transport', async () => {
    const mgr = await connect();
    expect(mgr.transport).toBe('wifi');
  });
});
