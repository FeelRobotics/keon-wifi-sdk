/// <reference types="web-bluetooth" />

import { getDeviceConnectionKey } from './api/token-helpers';

import { fetchAccessToken, fetchRegistrationToken } from './api/oauth-api';
import { AuthError } from './errors';
import { TokenResult } from './core/types';

/**
 * Authenticates with the OAuth server and returns the tokens needed to
 * provision and control a device. Transport-agnostic.
 *
 * @param feelAppsToken Partner access token issued by FeelRobotics.
 * @param deviceConnectionKey Optional key from a previous session to re-associate the same device.
 * @throws {AuthError} when authentication or token retrieval fails.
 */
export async function getTokenForKeonWiFi(
  feelAppsToken: string,
  deviceConnectionKey: string | null = null
): Promise<TokenResult> {
  let accessToken: string | null;
  try {
    [accessToken] = await fetchAccessToken(feelAppsToken, deviceConnectionKey);
  } catch (error) {
    throw new AuthError('Failed to authenticate with the Keon OAuth server', {
      cause: error,
    });
  }

  if (!accessToken) {
    throw new AuthError('Failed to authenticate with the Keon OAuth server');
  }

  let registrationToken: string | null;
  try {
    registrationToken = await fetchRegistrationToken(accessToken);
  } catch (error) {
    throw new AuthError('Failed to obtain a registration token', {
      cause: error,
    });
  }
  if (!registrationToken) {
    throw new AuthError('Failed to obtain a registration token');
  }

  let newDeviceConnectionKey: string | null;
  try {
    newDeviceConnectionKey = getDeviceConnectionKey(accessToken);
  } catch (error) {
    throw new AuthError(
      'Registration token is missing a device connection key',
      { cause: error }
    );
  }
  if (!newDeviceConnectionKey) {
    throw new AuthError(
      'Registration token is missing a device connection key'
    );
  }

  return { registrationToken, deviceConnectionKey: newDeviceConnectionKey };
}

// Transport managers — one per communication channel, all KeonControllers.
export { BleManager } from './managers/BleManager';
export { WifiManager } from './managers/WifiManager';
export { FugManager } from './managers/FugManager';
export type { FugConnectOptions } from './managers/FugManager';

// Pluggable device drivers.
export type { KeonDeviceDriver } from './devices/types';

export { isTokenFreshEnough } from './api/token-helpers';
export {
  KeonError,
  AuthError,
  KeonBLEError,
  KeonProvisioningError,
} from './errors';
export type {
  KeonTransport,
  KeonController,
  RemoteController,
  BleController,
  TokenResult,
  DeviceInfo,
  KeonDeviceStatus,
  KeonBlePosition,
  KeonProvisioningEvent,
  KeonProvisioningEventSource,
  KeonProvisioningOptions,
  KeonProvisioningStage,
  KeonProvisioningStatus,
  RemoteCallbacks,
  BleCallbacks,
} from './core/types';
