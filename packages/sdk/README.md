# @feelrobotics/keon-wifi-sdk

Framework-agnostic TypeScript SDK for provisioning and controlling **Keon**
devices. It handles authentication, Bluetooth LE provisioning, and real-time
device control over three transports — with no UI-framework dependency.

- 🔌 **Provision** a device's WiFi over Bluetooth LE (Web Bluetooth).
- 🎮 **Control** a device over **BLE**, **WiFi** (Socket.IO), or **FUG** (REST) —
  one common `KeonController` interface for all three.
- 🧩 **Transparent devices** — KEON WIFI and KEON2 are handled by pluggable
  drivers; your code never branches on the device version.
- 📦 **Tiny** (~4 KB brotli), tree-shakeable, ships ESM + CJS + types.
- 🌍 **Works anywhere** — Vanilla, React, Vue, Svelte, Angular, Node.

> **Using React?** Install [`@feelrobotics/keon-wifi-sdk-react`](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk-react)
> for a ready-made `useKeonWiFi` hook. It re-exports everything here.

---

## Concepts

The SDK is built on **two orthogonal axes**:

- **Transports** — _how_ commands reach the device. Each is a manager class that
  implements the common **`KeonController`** interface:
  - **`BleManager`** — direct Web Bluetooth (provisioning + control). Browser-only.
  - **`WifiManager`** — Socket.IO to the FEC server. Status is pushed.
  - **`FugManager`** — REST to the Feel Unified Gateway. Status is pulled.
- **Devices** — _what_ differs between generations (UUIDs, limits). Each is a
  pluggable driver. `BleManager` picks the right one from the device the user
  selects, so KEON WIFI and KEON2 are transparent to your code.

Construct any manager with its static async `connect()` factory.

---

## Requirements

Provisioning and BLE control use the **Web Bluetooth API**, which only works:

- in Chromium-based browsers (Chrome, Edge, Opera) — _not_ Firefox/Safari;
- over `https://` or `localhost`;
- when triggered by a **user gesture** (e.g. a click handler).

`WifiManager` (Socket.IO) and `FugManager` (REST) work in any browser and in
Node.js. Only the BLE transport is browser-only.

---

## Install

```sh
npm install @feelrobotics/keon-wifi-sdk
# or
yarn add @feelrobotics/keon-wifi-sdk
```

---

## Token glossary

| Token                               | Where it comes from                                                                                            | Used for                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **`feelAppsToken`** (partner token) | Your backend requests it from **ControlPlane**: `GET /api/v1/partner/{partner_key}/token`.                     | Authenticating with the OAuth servers.                                     |
| **`registrationToken`**             | Returned by `getTokenForKeonWiFi`. A JWT that also encodes the WebSocket server URL and device connection key. | BLE provisioning + WiFi control credentials.                               |
| **`deviceConnectionKey`**           | Returned by `getTokenForKeonWiFi`.                                                                             | Re-associate the **same** device across sessions; also the FUG credential. |

---

## Quick start (Vanilla JS/TS)

```typescript
import {
  getTokenForKeonWiFi,
  BleManager,
  WifiManager,
} from '@feelrobotics/keon-wifi-sdk';

// 1. Authenticate (throws AuthError on failure).
const { registrationToken, deviceConnectionKey } =
  await getTokenForKeonWiFi(partnerToken);

// 2. Provision over Bluetooth (must run from a user gesture). The right device
//    driver (KEON WIFI / KEON2) is selected automatically.
const ble = await BleManager.connect();
try {
  await ble.provision('MyWiFi', 'pass123', registrationToken, {
    onStatus: (event) =>
      console.log(event.stage, event.status, event.code, event.rawValue),
    postProvisionListenUntilDisconnect: true,
  });
  console.log('Provisioned', ble.deviceInfo.serialNumber);
} finally {
  await ble.disconnect();
}

// 3. Control the device in real time over WiFi.
const manager = await WifiManager.connect(partnerToken, registrationToken, {
  // A connection can cover several devices, so status arrives as a list.
  onStatusChange: (statuses) =>
    console.log('battery', statuses[0]?.battery_status),
});
await manager.moveTo(50, 90);
// …later
await manager.disconnect();
```

### Direct BLE control (no server)

```typescript
const ble = await BleManager.connect({
  onPosition: (p) => console.log('position', p.position),
});
await ble.moveTo(50, 90);
await ble.movementBetween(60, 0, 100);
console.log('battery', await ble.getBattery());
await ble.disconnect();
```

### Control over FUG (REST)

```typescript
import { FugManager } from '@feelrobotics/keon-wifi-sdk';

const manager = await FugManager.connect({
  deviceConnectionKey, // also the credential: sent as `Authorization: DCK <key>`
  statusPollIntervalSec: 30, // optional poll interval (seconds), default 30; 0 = off
  onStatusChange: (statuses) =>
    console.log('battery', statuses[0]?.battery_status),
});
await manager.forceStatusReport(); // pull the initial status (connect doesn't)
await manager.moveTo(50, 90);
await manager.disconnect();
```

---

## Integration examples

### React

Use the [`@feelrobotics/keon-wifi-sdk-react`](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk-react)
adapter:

```tsx
import { useKeonWiFi } from '@feelrobotics/keon-wifi-sdk-react';

function DeviceControl({ partnerToken }: { partnerToken: string }) {
  const { status, controller, provision } = useKeonWiFi(partnerToken);

  return (
    <>
      <button onClick={() => provision('MyWiFi', 'pass123')}>Provision</button>
      {status && <p>Battery: {status.battery_status}%</p>}
      <button onClick={() => controller?.moveTo(50, 90)}>Move</button>
      <button onClick={() => controller?.stop()}>Stop</button>
    </>
  );
}
```

The hook exposes `connectBle`, `connectWifi`, `connectFug`, `provision`,
`disconnect`, plus `controller`, `status` (primary device), `statuses` (all
devices) and `position` state.

### Vue 3 (composable)

```typescript
import { ref, shallowRef, onUnmounted } from 'vue';
import {
  getTokenForKeonWiFi,
  BleManager,
  WifiManager,
} from '@feelrobotics/keon-wifi-sdk';
import type {
  RemoteController,
  KeonDeviceStatus,
} from '@feelrobotics/keon-wifi-sdk';

export function useKeon(partnerToken: string) {
  const statuses = ref<KeonDeviceStatus[]>([]);
  const manager = shallowRef<RemoteController | null>(null);

  async function provision(ssid: string, password: string) {
    const { registrationToken } = await getTokenForKeonWiFi(partnerToken);
    const ble = await BleManager.connect();
    try {
      await ble.provision(ssid, password, registrationToken);
    } finally {
      await ble.disconnect();
    }
    manager.value = await WifiManager.connect(partnerToken, registrationToken, {
      onStatusChange: (s) => (statuses.value = s),
    });
  }

  onUnmounted(() => manager.value?.disconnect());
  return { statuses, manager, provision };
}
```

### Node.js (control only)

BLE is browser-only, but you can control an already-provisioned device over
WiFi or FUG from Node:

```typescript
import { WifiManager } from '@feelrobotics/keon-wifi-sdk';

const manager = await WifiManager.connect(partnerToken, registrationToken, {
  onStatusChange: (statuses) =>
    console.log('battery', statuses[0]?.battery_status),
});
await manager.moveTo(50, 90);
await manager.disconnect();
```

---

## API reference

### `getTokenForKeonWiFi(feelAppsToken, deviceConnectionKey?)`

Authenticates against the FeelMe OAuth server and returns
`{ registrationToken, deviceConnectionKey }`.

- `deviceConnectionKey?` — pass a key from a previous session to re-associate the same device.
- **Throws** `AuthError` if authentication fails.

### `KeonController` (common to all transports)

| Method                             | Description                                          |
| ---------------------------------- | ---------------------------------------------------- |
| `moveTo(speed, position)`          | Move to an absolute position. Both integers 0–100.   |
| `movementBetween(speed, min, max)` | Oscillate between two positions. All integers 0–100. |
| `stop()`                           | Stop movement.                                       |
| `getStatus()`                      | Primary device `KeonDeviceStatus` (or null).         |
| `disconnect()`                     | Tear down the connection.                            |
| `transport`                        | `'ble' \| 'wifi' \| 'fug'`.                          |

### `BleManager.connect({ onPosition? })` → `BleController`

Prompts the user to pick a device, connects over GATT, reads device info and
enters movement mode. Adds to `KeonController`:

| Member                                       | Description                                                      |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `provision(ssid, password, token, options?)` | Write WiFi credentials + registration token.                     |
| `getBattery()`                               | Battery level 0–100, or -1 when unavailable.                     |
| `testDevice()`                               | Short movement to confirm the device responds.                   |
| `onPosition(cb)`                             | Subscribe to motor position notifications.                       |
| `deviceInfo`                                 | `{ id, name, firmwareVersion, manufacturerName, serialNumber }`. |

- **Throws** `KeonBLEError` on selection/connection failure or unsupported device.
- **Throws** `KeonProvisioningError` on missing arguments or handshake failure.

`provision()` accepts `{ onStatus }` to observe SDK progress and device-originated
BLE provisioning responses. Device status codes are decoded as `16 = success`,
`17 = ongoing`, `18 = failed`; the emitted `KeonProvisioningEvent` also includes
the active stage, source (`sdk`, `device-readback`, `device-notification`), and
raw bytes received from the characteristic. Set `finalStatusTimeoutMs` to keep
listening for a late final success/failure notification after `PROV_CRED_CONFIRM`
before the method resolves. Set `postProvisionListenUntilDisconnect` to keep
listening for late BLE messages until the device itself drops the Bluetooth
GATT connection.

### `WifiManager.connect(feelAppsToken, registrationToken, callbacks?)` → `RemoteController`

Opens a Socket.IO connection to the FEC server. `callbacks` accepts
`onStatusChange` and `onUserAction`. **Throws** `AuthError` if credentials
cannot be obtained.

A single connection can cover several devices, so `onStatusChange` receives the
full list of device statuses (one entry per device); `getStatus()` returns the
first (primary) device and `getStatuses()` returns them all.

Status payloads can be partial. Treat every `KeonDeviceStatus` field as
optional because devices may omit keys until a later report.

### `FugManager.connect({ deviceConnectionKey, statusPollIntervalSec?, onStatusChange? })` → `RemoteController`

Connects to the FUG REST gateway. The `deviceConnectionKey` is both the
credential (sent as `Authorization: DCK <key>`) and the device identifier.
Status is pull-based: it's polled every `statusPollIntervalSec` seconds
(default 30; set `0` to disable) and you can call `forceStatusReport()` on
demand. `connect` does not fetch status itself — call `forceStatusReport()`
after connecting if you need the initial status before the first poll.

### `RemoteController` (WiFi + FUG)

Adds to `KeonController`:

| Method                                    | Description                                 |
| ----------------------------------------- | ------------------------------------------- |
| `getStatuses()`                           | Statuses of every device on the connection. |
| `setIntensity(intensity)`                 | Adjust intensity. Integer percentage 0–100. |
| `setStatusInterval(interval)`             | Status report interval. Integer 0–1000.     |
| `switchToBtMode()` / `resetCredentials()` | Reprovision commands.                       |
| `forceStatusReport()`                     | Request an immediate status report.         |

### Device drivers

`requestDeviceOptions()` builds the Web Bluetooth filter covering every supported
device; `matchDriver(device)` and the `DRIVERS` array are exported for advanced
use. Adding a device is one driver file plus one line in the registry.

### Token freshness helper

`isTokenFreshEnough(token)` is a local expiration/freshness helper only — it
decodes the payload and requires an `exp` claim but does **not** verify the
signature. Server-side endpoints remain the authority.

### Errors

All SDK errors extend `KeonError`:

```typescript
import { KeonError, AuthError } from '@feelrobotics/keon-wifi-sdk';

try {
  await getTokenForKeonWiFi(partnerToken);
} catch (e) {
  if (e instanceof AuthError) {
    /* auth-specific */
  } else if (e instanceof KeonError) {
    /* any SDK error */
  }
}
```

`KeonError` · `AuthError` · `KeonBLEError` · `KeonProvisioningError`

---

## License

MIT
