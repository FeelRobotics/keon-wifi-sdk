# @feelrobotics/keon-wifi-sdk-react

React hook for the [Keon WiFi SDK](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk).
Provision and control Keon WiFi devices from a React app with a single hook.

> Provisioning relies on the **Web Bluetooth API** and works only in supporting
> browsers (Chrome, Edge, Opera) over `https://` or `localhost`, triggered by a
> user gesture.

## Install

```bash
npm install @feelrobotics/keon-wifi-sdk-react @feelrobotics/keon-wifi-sdk react
```

The core SDK is re-exported from this package, so you can import everything from
`@feelrobotics/keon-wifi-sdk-react`.

## Usage

```tsx
import { useKeonWiFi } from '@feelrobotics/keon-wifi-sdk-react';

function DeviceControl({ partnerToken }: { partnerToken: string }) {
  const { controller, status, statuses, position, provision, disconnect } =
    useKeonWiFi(partnerToken);

  return (
    <>
      <button onClick={() => provision('MyWiFi', 'pass123')}>
        Provision device
      </button>
      {status && <p>Primary battery: {status.battery_status}%</p>}
      {statuses.length > 1 && <p>Devices online: {statuses.length}</p>}
      {position && <p>BLE position: {position.position}</p>}
      <button onClick={() => controller?.moveTo(50, 90)}>Move</button>
      <button onClick={() => controller?.stop()}>Stop</button>
      <button onClick={disconnect}>Disconnect</button>
    </>
  );
}
```

## API

`useKeonWiFi(feelAppsToken)` returns:

| Field                                                       | Description                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controller`                                                | Active `KeonController` for BLE, WiFi, or FUG, or `null`.                                                                                                                                                                       |
| `status`                                                    | Primary device `KeonDeviceStatus` from the remote status list, or `null`.                                                                                                                                                       |
| `statuses`                                                  | Latest `KeonDeviceStatus[]` for every device on the WiFi/FUG connection. A single connection key can cover multiple devices.                                                                                                    |
| `position`                                                  | Latest BLE motor position notification, or `null`.                                                                                                                                                                             |
| `provision(ssid, password, deviceConnectionKey?, options?)` | Full flow: fetch tokens → BLE provision → connect the WiFi controller. Pass `{ onStatus, postProvisionListenUntilDisconnect }` to observe BLE provisioning status events. Resolves with `{ device, registrationToken, deviceConnectionKey }`. |
| `connectBle()`                                              | Connect over direct BLE control and update `position` from BLE notifications.                                                                                                                                                   |
| `connectWifi(registrationToken)`                            | Connect the WiFi Socket.IO controller to an already-provisioned device and update `statuses` via `onStatusChange(statuses: KeonDeviceStatus[])`.                                                                                |
| `connectFug({ deviceConnectionKey, statusPollIntervalSec? })` | Connect the FUG REST controller and update `statuses` from `forceStatusReport()` or polling.                                                                                                                                    |
| `disconnect()`                                              | Close the active controller and reset hook state.                                                                                                                                                                               |

The hook closes the active controller automatically when the component unmounts.

## License

MIT
