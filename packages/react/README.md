# @feelrobotics/keon-wifi-sdk-react

React hook for the [Keon WiFi SDK](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk).
Controls Keon WiFi devices from a React component with a single hook.

The hook covers all three transports. `connectFug` is the recommended path (REST, just a `deviceConnectionKey`); `connectWifi` is for real-time control; `provision` / `connectBle` are the browser-only BLE fallback. A device is normally put on WiFi by the user with the **FeelConnect app**, which yields the `deviceConnectionKey`.

> The BLE fallback relies on the **Web Bluetooth API** and works only in
> supporting browsers (Chrome, Edge, Opera) over `https://` or `localhost`,
> triggered by a user gesture.

## Install

```bash
npm install @feelrobotics/keon-wifi-sdk-react @feelrobotics/keon-wifi-sdk react
```

The core SDK is re-exported from this package, so everything can be imported from `@feelrobotics/keon-wifi-sdk-react`.

## Usage

```tsx
import { useKeonWiFi } from '@feelrobotics/keon-wifi-sdk-react';

function DeviceControl({
  partnerToken,
  deviceConnectionKey,
}: {
  partnerToken: string;
  deviceConnectionKey: string;
}) {
  const { controller, status, statuses, position, connectFug, disconnect } =
    useKeonWiFi(partnerToken);

  return (
    <>
      <button onClick={() => connectFug({ deviceConnectionKey })}>
        Connect
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

| Field                                                         | Description                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controller`                                                  | Active `KeonController` for BLE, WiFi, or FUG, or `null`.                                                                                                                                                                                                                           |
| `status`                                                      | Primary device `KeonDeviceStatus` from the remote status list, or `null`.                                                                                                                                                                                                           |
| `statuses`                                                    | Latest `KeonDeviceStatus[]` for every device on the WiFi/FUG connection. A single connection key can cover multiple devices.                                                                                                                                                        |
| `position`                                                    | Latest BLE motor position notification, or `null`.                                                                                                                                                                                                                                  |
| `connectFug({ deviceConnectionKey, statusPollIntervalSec? })` | **Recommended.** Connect the FUG REST controller and update `statuses` from `forceStatusReport()` or polling.                                                                                                                                                                       |
| `connectWifi(registrationToken)`                              | Real-time path. Connect the WiFi Socket.IO controller to an already-provisioned device and update `statuses` via `onStatusChange(statuses: KeonDeviceStatus[])`.                                                                                                                    |
| `connectBle()`                                                | BLE fallback. Connect over direct BLE control and update `position` from BLE notifications.                                                                                                                                                                                         |
| `provision(ssid, password, deviceConnectionKey?, options?)`   | BLE fallback for in-app provisioning. Full flow: fetch tokens → BLE provision → connect the WiFi controller. Pass `{ onStatus, postProvisionListenUntilDisconnect }` to observe BLE provisioning status events. Resolves with `{ device, registrationToken, deviceConnectionKey }`. |
| `disconnect()`                                                | Close the active controller and reset hook state.                                                                                                                                                                                                                                   |

The hook closes the active controller automatically when the component unmounts.

## License

MIT
