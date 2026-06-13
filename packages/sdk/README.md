# @feelrobotics/keon-wifi-sdk

Framework-agnostic TypeScript SDK for controlling **Keon** devices. It handles authentication, device control over three transports, and (as a fallback) Bluetooth LE provisioning — with no UI-framework dependency.

- **Control** a device over **FUG** (REST, recommended), **WiFi** (Socket.IO, real-time), or **BLE** (Web Bluetooth, fallback) — one common `KeonController` interface for all three.
- **Server-friendly** — the FUG transport needs only a `deviceConnectionKey` and HTTP, so a device can be driven from a back-end or a browser alike.
- **Transparent devices** — KEON WIFI and KEON2 are handled by pluggable drivers; consumer code never branches on the device version.
- **Tiny** (~4 KB brotli), tree-shakeable, ships ESM + CJS + types.
- **Works anywhere** — Vanilla, React, Vue, Svelte, Angular, Node.

> **Using React?** Install [`@feelrobotics/keon-wifi-sdk-react`](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk-react)
> for a ready-made `useKeonWiFi` hook. It re-exports everything here.

---

## Concepts

The SDK is built on **two orthogonal axes**:

- **Transports** — _how_ commands reach the device. Each is a manager class that implements the common **`KeonController`** interface. Chosen by connection method:
  - **`FugManager`** — REST to the Feel Unified Gateway, authenticated with a
    `deviceConnectionKey`. Status is pulled. **Recommended default**: no Web
    Bluetooth, no in-browser OAuth, works in the browser and in Node/back-end.
  - **`WifiManager`** — Socket.IO to the FEC server. Status is pushed with low
    latency. Suitable **when real-time, interactive control is required**.
  - **`BleManager`** — direct Web Bluetooth (provisioning + control), browser-only.
    A **fallback**: provisioning is normally done by the FeelConnect app, so reach
    for BLE only for in-browser provisioning or local control without a server.
- **Devices** — _what_ differs between generations (UUIDs, limits). Each is a
  pluggable driver. `BleManager` picks the right one from the device the user
  selects, so KEON WIFI and KEON2 are transparent to consumer code.

Construct any manager with its static async `connect()` factory.

### How a device gets onto WiFi

The Keon user puts the device on WiFi using the **FeelConnect app**, which
produces a `deviceConnectionKey` (DCK). The integrating application then controls
that device with the DCK over FUG (recommended) or, for real-time sessions, over
WiFi. `BleManager.provision()` is reserved as a fallback for cases where
provisioning must happen inside the application itself.

---

## Requirements

`FugManager` (REST) and `WifiManager` (Socket.IO) work in any browser **and** in
Node.js — they have no Web Bluetooth dependency.

Only the **`BleManager`** fallback uses the **Web Bluetooth API**, which works:

- in Chromium-based browsers (Chrome, Edge, Opera) — _not_ Firefox/Safari;
- over `https://` or `localhost`;
- when triggered by a **user gesture** (e.g. a click handler).

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
| **`feelAppsToken`** (partner token) | Requested from **ControlPlane** by the backend: `GET /api/v1/partner/{partner_key}/token`.                     | Authenticating with the OAuth servers.                                     |
| **`registrationToken`**             | Returned by `getTokenForKeonWiFi`. A JWT that also encodes the WebSocket server URL and device connection key. | BLE provisioning + WiFi control credentials.                               |
| **`deviceConnectionKey`**           | Returned by `getTokenForKeonWiFi`.                                                                             | Re-associate the **same** device across sessions; also the FUG credential. |

---

## Quick start (FUG — recommended)

Controls an already-provisioned device (put on WiFi with the FeelConnect app)
over REST. Only its `deviceConnectionKey` is required; this runs in a browser or
in Node.

```typescript
import { FugManager } from '@feelrobotics/keon-wifi-sdk';

const manager = await FugManager.connect({
  deviceConnectionKey, // also the credential: sent as `Authorization: DCK <key>`
  statusPollIntervalSec: 30, // optional poll interval (seconds), default 30; 0 = off
  // A connection can cover several devices, so status arrives as a list.
  onStatusChange: (statuses) =>
    console.log('battery', statuses[0]?.battery_status),
});
await manager.forceStatusReport(); // pull the initial status (connect doesn't)
await manager.moveTo(50, 90);
// …later
await manager.disconnect();
```

### Real-time control over WiFi

For live, interactive control, use the Socket.IO transport instead. Status is
pushed (no polling). It needs a `registrationToken` from `getTokenForKeonWiFi`.

```typescript
import { getTokenForKeonWiFi, WifiManager } from '@feelrobotics/keon-wifi-sdk';

const { registrationToken } = await getTokenForKeonWiFi(
  partnerToken,
  deviceConnectionKey
);

const manager = await WifiManager.connect(partnerToken, registrationToken, {
  onStatusChange: (statuses) =>
    console.log('battery', statuses[0]?.battery_status),
});
await manager.moveTo(50, 90);
await manager.disconnect();
```

### Fallback: provision and control over BLE

Browser-only. Provisioning is normally handled by the FeelConnect app — this path
is for cases where provisioning (or driving the motor locally) must happen inside
the application itself. The right device driver (KEON WIFI / KEON2) is selected
automatically.

```typescript
import { getTokenForKeonWiFi, BleManager } from '@feelrobotics/keon-wifi-sdk';

// Provisioning needs a registration token; control alone does not.
const { registrationToken } = await getTokenForKeonWiFi(partnerToken);

// Must run from a user gesture (e.g. a click handler).
const ble = await BleManager.connect({
  onPosition: (p) => console.log('position', p.position),
});
try {
  await ble.provision('MyWiFi', 'pass123', registrationToken, {
    onStatus: (event) =>
      console.log(event.stage, event.status, event.code, event.rawValue),
    postProvisionListenUntilDisconnect: true,
  });
  console.log('Provisioned', ble.deviceInfo.serialNumber);

  // Drive the motor directly over BLE, no server involved.
  await ble.moveTo(50, 90);
  await ble.movementBetween(60, 0, 100);
  console.log('battery', await ble.getBattery());
} finally {
  await ble.disconnect();
}
```

---

## Integration examples

### Node.js / back-end (FUG)

No browser, no Web Bluetooth — just a `deviceConnectionKey` and HTTP. This is the
cleanest way to drive a device from a server or job:

```typescript
import { FugManager } from '@feelrobotics/keon-wifi-sdk';

const manager = await FugManager.connect({
  deviceConnectionKey,
  onStatusChange: (statuses) =>
    console.log('battery', statuses[0]?.battery_status),
});
await manager.forceStatusReport();
await manager.moveTo(50, 90);
await manager.disconnect();
```

### React

Use the [`@feelrobotics/keon-wifi-sdk-react`](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk-react)
adapter. `connectFug` is the recommended path; `connectWifi` covers real-time and
`provision` / `connectBle` are the BLE fallback:

```tsx
import { useKeonWiFi } from '@feelrobotics/keon-wifi-sdk-react';

function DeviceControl({
  partnerToken,
  deviceConnectionKey,
}: {
  partnerToken: string;
  deviceConnectionKey: string;
}) {
  const { status, controller, connectFug } = useKeonWiFi(partnerToken);

  return (
    <>
      <button onClick={() => connectFug({ deviceConnectionKey })}>
        Connect
      </button>
      {status && <p>Battery: {status.battery_status}%</p>}
      <button onClick={() => controller?.moveTo(50, 90)}>Move</button>
      <button onClick={() => controller?.stop()}>Stop</button>
    </>
  );
}
```

The hook also exposes `connectWifi`, `connectBle`, `provision`, `disconnect`,
plus `controller`, `statuses` (all devices) and `position` state.

### Vue 3 (composable, real-time over WiFi)

For pushed, low-latency status, wire `WifiManager` into a composable:

```typescript
import { ref, shallowRef, onUnmounted } from 'vue';
import { getTokenForKeonWiFi, WifiManager } from '@feelrobotics/keon-wifi-sdk';
import type {
  RemoteController,
  KeonDeviceStatus,
} from '@feelrobotics/keon-wifi-sdk';

export function useKeon(partnerToken: string) {
  const statuses = ref<KeonDeviceStatus[]>([]);
  const manager = shallowRef<RemoteController | null>(null);

  async function connect(deviceConnectionKey: string) {
    const { registrationToken } = await getTokenForKeonWiFi(
      partnerToken,
      deviceConnectionKey
    );
    manager.value = await WifiManager.connect(partnerToken, registrationToken, {
      onStatusChange: (s) => (statuses.value = s),
    });
  }

  onUnmounted(() => manager.value?.disconnect());
  return { statuses, manager, connect };
}
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

### `RemoteController` (FUG + WiFi)

The server-backed transports add to `KeonController`:

| Method                                    | Description                                 |
| ----------------------------------------- | ------------------------------------------- |
| `getStatuses()`                           | Statuses of every device on the connection. |
| `setIntensity(intensity)`                 | Adjust intensity. Integer percentage 0–100. |
| `setStatusInterval(interval)`             | Status report interval. Integer 0–1000.     |
| `switchToBtMode()` / `resetCredentials()` | Reprovision commands.                       |
| `forceStatusReport()`                     | Request an immediate status report.         |

A single connection can cover several devices, so `onStatusChange` receives the
full list of device statuses (one entry per device); `getStatus()` returns the
first (primary) device and `getStatuses()` returns them all. Status payloads can
be partial — treat every `KeonDeviceStatus` field as optional, because devices
may omit keys until a later report.

### `FugManager.connect({ deviceConnectionKey, statusPollIntervalSec?, onStatusChange? })` → `RemoteController`

The recommended transport. Connects to the FUG REST gateway. The
`deviceConnectionKey` is both the credential (sent as `Authorization: DCK <key>`)
and the device identifier. Status is pull-based: it's polled every
`statusPollIntervalSec` seconds (default 30; set `0` to disable) and
`forceStatusReport()` can be called on demand. `connect` does not fetch status
itself — call `forceStatusReport()` after connecting to obtain the initial status
before the first poll.

### `WifiManager.connect(feelAppsToken, registrationToken, callbacks?)` → `RemoteController`

For real-time control. Opens a Socket.IO connection to the FEC server; status is
pushed. `callbacks` accepts `onStatusChange` and `onUserAction`. **Throws**
`AuthError` if credentials cannot be obtained.

### `BleManager.connect({ onPosition? })` → `BleController`

The browser-only fallback. Prompts the user to pick a device, connects over GATT,
reads device info and enters movement mode. Adds to `KeonController`:

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
