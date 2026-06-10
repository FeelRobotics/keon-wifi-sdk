import { dataViewToAsciiString, tranformDataToArray } from '../utils/helpers';

const PRIMARY_SERVICE_UUID: BluetoothCharacteristicUUID = 0x1900;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FIRMWARE_VERSION_CHAR_UUID: BluetoothCharacteristicUUID = 0x1901;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MANUFACTURE_NAME_CHAR_UUID: BluetoothCharacteristicUUID = 0x1902;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const HARDWARE_MODEL_INFO_CHAR_UUID: BluetoothCharacteristicUUID = 0x1903;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SERIAL_NUMBER_CHAR_UUID: BluetoothCharacteristicUUID = 0x1903;

const PROVISIONING_CHAR_UUID = 0x2001;

const BATTERY_STATUS_CHAR_UUID: BluetoothCharacteristicUUID = 0x2a19;
const MOTOR_COMMAND_CHAR_UUID: BluetoothCharacteristicUUID = 0x1800;

const name = 'KEON WIFI';

const KEON_MIN_POS = 0;
const KEON_MAX_POS = 90;
const KEON_FULL_CYCLE_TIME_MSEC = 600;

const PREFIX_SSID_NAME = '0';
const PREFIX_PASSWORD = '1';
const PREFIX_TOKEN = '2';

const PROV_CHANGE_MODE_WIFI = 0x1;
const PROV_START = 0x2;
const PROV_CRED_CONFIRM = 0x3;
const PROV_REVERT = 0x4;
const PROV_CLEAN_LIST = 0x5;

/**
 * Default Maximum Transmission Unit (MTU) size in bytes.
 */
const DEFAULT_MTU_SIZE = 512;

export default class Keon {
  private device?: BluetoothDevice;
  private controlService?: BluetoothRemoteGATTService;
  private deviceNotInitMsg = 'The device should be connected first.';
  private deviceNotFound = 'The device is invalid or not found';
  private wentWrong = 'Something went wrong...';

  static get deviceName() {
    return name;
  }

  static get services() {
    return [PRIMARY_SERVICE_UUID];
  }

  get companyName() {
    return 'Kiiroo';
  }

  static get requestDeviceOptions(): RequestDeviceOptions {
    return {
      filters: [{ name: this.deviceName }],
      optionalServices: [PRIMARY_SERVICE_UUID],
    };
  }

  async connect(device: BluetoothDevice): Promise<Record<string, any>> {
    if (!device.gatt) {
      return Promise.reject(this.deviceNotFound);
    }

    this.device = device;
    const characteristicsMap = {
      'Firmware Version': FIRMWARE_VERSION_CHAR_UUID,
      'Manufacturer Name': MANUFACTURE_NAME_CHAR_UUID,
      'Serial Number': SERIAL_NUMBER_CHAR_UUID,
    };

    const characteristicsData: Record<string, any> = {
      'device.id': this.device.id,
      'device.name': this.device.name,
    };
    const server: BluetoothRemoteGATTServer = await device.gatt.connect();
    this.controlService = await server.getPrimaryService(PRIMARY_SERVICE_UUID);
    for (const [name, uuid] of Object.entries(characteristicsMap)) {
      try {
        let characteristic = await this.controlService.getCharacteristic(uuid);
        let response = await characteristic.readValue();
        characteristicsData[name] = dataViewToAsciiString(response);
      } catch (error) {
        console.error(`Error while reading: ${name}:`, error);
        characteristicsData[name] = null;
      }
    }
    return characteristicsData;
  }

  async disconnect(): Promise<void> {
    this.device?.gatt!.disconnect();
  }

  isConnected(): boolean {
    return !!this.device?.gatt?.connected;
  }

  async provisioning(
    ssid: string,
    psswrd: string,
    token: string
  ): Promise<void> {
    if (!this.controlService || !this.isConnected()) {
      return Promise.reject(this.deviceNotInitMsg);
    }
    let provChar: BluetoothRemoteGATTCharacteristic = await this.controlService.getCharacteristic(
      PROVISIONING_CHAR_UUID
    );

    const handleResponse = async (
      stage: string,
      expectedStatusCode: number
    ) => {
      let statusResponse = (await provChar.readValue()).getUint8(0);
      if (statusResponse !== expectedStatusCode) {
        console.error(
          `Unexpected status code: ${statusResponse} at provosioning step ${stage}`
        );
        return Promise.reject(this.wentWrong);
      }
      console.log(
        `Status code: ${statusResponse} at provosioning step ${stage}`
      );
      return Promise.resolve();
    };

    let dt = tranformDataToArray([PROV_CLEAN_LIST]);
    await provChar.writeValue(dt);
    await handleResponse('PROV_CLEAN_LIST', 17);

    dt = tranformDataToArray([PROV_CHANGE_MODE_WIFI]);
    await provChar.writeValue(dt);
    await handleResponse('PROV_CHANGE_MODE_WIFI', 17);

    dt = tranformDataToArray([PROV_START]);
    await provChar.writeValue(dt);
    await handleResponse('PROV_START', 17);

    dt = tranformDataToArray(PREFIX_SSID_NAME + ssid);
    await provChar.writeValue(dt);

    dt = tranformDataToArray(PREFIX_PASSWORD + psswrd);
    await provChar.writeValue(dt);
    await handleResponse('PREFIX_PASSWORD', 17);

    // Token (you should send max 500 characters for each operation)
    const packetSize = DEFAULT_MTU_SIZE - 12;
    for (let i = 0; i < token.length; i += packetSize) {
      const chunk = token.slice(i, i + packetSize);
      dt = tranformDataToArray(PREFIX_TOKEN + chunk);
      await provChar.writeValue(dt);
    }
    await handleResponse('PREFIX_TOKEN:' + token.length, 17);

    dt = tranformDataToArray([PROV_CRED_CONFIRM]);
    await provChar.writeValue(dt);
    await handleResponse('PROV_CRED_CONFIRM', 17);
  }
}
