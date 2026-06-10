import { getDeviceConnectionKey } from './api/token-helpers';
import { chooseBestServer, getCredentialForCcWsServer } from './api/helpers';
import { fetchRegistrationToken } from './api/oauth-api';

import Keon from './ble/KeonWiFi';
import { KeonManager, KeonManagerOptions } from './socketio/keonManager';

const getTokenForKeonWiFi = async (
  feelAppsToken: string,
  deviceConnectionKey: string | null = null
): Promise<[string | null, string | null]> => {
  const [bestServer, accessToken] = await chooseBestServer(
    feelAppsToken,
    deviceConnectionKey
  );

  if (!bestServer || !accessToken) {
    return [null, null];
  }

  const registrationToken = await fetchRegistrationToken(
    bestServer,
    accessToken
  );

  const newDeviceConnectionKey = getDeviceConnectionKey(accessToken);

  return [registrationToken, newDeviceConnectionKey];
};

async function keonConnect(keon: Keon) {
  let device;

  try {
    device = await navigator.bluetooth.requestDevice(Keon.requestDeviceOptions);
  } catch (error) {
    console.error(error);
    return null;
  }
  const characteristicsData = await keon.connect(device);
  return characteristicsData;
}

async function keonProvisioning(
  keon: Keon,
  registrationToken: string,
  ssid: string,
  password: string
) {
  if (!registrationToken) {
    console.error('Please login to the server first!');
    return;
  }
  if (!ssid || !password) {
    console.error('Please fill WiFi credentials first!');
    return;
  }
  if (!keon.isConnected) {
    console.error('Please connect to the device first!');
    return;
  }
  try {
    await keon.provisioning(ssid, password, registrationToken);
    await keon.disconnect();
  } catch (error) {
    console.error(error);
  }
}

const provisioningKeonWiFi = async (
  registrationToken: string,
  ssid: string,
  password: string
): Promise<[Keon, any]> => {
  let keon = new Keon();
  const deviceData = await keonConnect(keon);
  await keonProvisioning(keon, registrationToken, ssid, password);
  return [keon, deviceData];
};

const keonWiFiManager = async (
  feelAppsToken: string,
  registrationToken: string,
  userActionHandler: (message: any) => void
) => {
  const [socketServerUrl, accessToken] = await getCredentialForCcWsServer(
    feelAppsToken,
    registrationToken
  );
  if (!socketServerUrl || !accessToken) {
    throw new Error('Tokens incorrect or not found');
  }

  return new KeonManager({
    socketServerUrl,
    accessToken,
    userActionHandler,
  });
};

export {
  getTokenForKeonWiFi,
  provisioningKeonWiFi,
  keonWiFiManager,
  KeonManager,
};
