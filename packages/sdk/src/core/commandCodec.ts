/**
 * Pure builders for the device command vocabulary shared by the server-backed
 * transports. Socket.IO emits each message as `event` + `payload`; the FUG REST
 * gateway maps `event` to the path `/api/<event>` and POSTs `payload` as the body.
 */
export interface RemoteMessage {
  event: string;
  payload: Record<string, unknown>;
}

export const move = (speed: number, position: number): RemoteMessage => ({
  event: 'send_command_to_devices',
  payload: {
    command_type: 'MOVEMENT',
    arguments: { speed, position },
  },
});

export const movementBetween = (
  speed: number,
  minPosition: number,
  maxPosition: number
): RemoteMessage => ({
  event: 'send_command_to_devices',
  payload: {
    command_type: 'MOVEMENT_BETWEEN',
    arguments: {
      speed,
      min_position: minPosition,
      max_position: maxPosition,
    },
  },
});

export const pause = (): RemoteMessage => ({
  event: 'send_command_to_devices',
  payload: { command_type: 'PAUSE', arguments: {} },
});

export const speedIntensity = (intensity: number): RemoteMessage => ({
  event: 'send_settings_to_device',
  payload: {
    setup_type: 'speed_intensity_adjustment',
    arguments: { intensity },
  },
});

export const rangeIntensity = (intensity: number): RemoteMessage => ({
  event: 'send_settings_to_device',
  payload: {
    setup_type: 'range_intensity_adjustment',
    arguments: { intensity },
  },
});

export const statusInterval = (interval: number): RemoteMessage => ({
  event: 'send_settings_to_device',
  payload: {
    setup_type: 'status_update_interval',
    arguments: { interval },
  },
});

export const reprovision = (
  reprovisionType: 'bt_mode' | 'reset_credentials'
): RemoteMessage => ({
  event: 'send_reprovision_command_to_device',
  payload: { reprovision_type: reprovisionType, arguments: {} },
});

export const getStatus = (): RemoteMessage => ({
  event: 'get_status_of_devices',
  payload: {},
});
