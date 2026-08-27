# Changelog

## 2.0.0

WiFi provisioning moved out of the SDK — setting a device up on WiFi is now done
with the **FeelConnect** app, which provides the `deviceConnectionKey`. The SDK
focuses on **controlling** already-configured devices.

### BREAKING CHANGES

- Removed `BleController.provision()` and the whole BLE WiFi-provisioning flow.
- Removed the provisioning types: `KeonProvisioningEvent`,
  `KeonProvisioningEventSource`, `KeonProvisioningOptions`,
  `KeonProvisioningStage`, `KeonProvisioningStatus`.
- Removed the `KeonProvisioningError` error class.
- `BleDeviceProfile` no longer has `provCharUuid` and `provisioning` fields
  (affects custom `KeonDeviceDriver` implementations).

### Added

- **ONYX ULTRA** device driver (shares KEON2's BLE service; matched by the
  advertised Bluetooth name).
- `BleController.driverName` — name of the driver that matched the connected
  device.
- `@types/web-bluetooth` is now a runtime dependency so the public types
  resolve for consumers without extra installs.

### Fixed

- The BLE position-notification listener is removed on `disconnect()` (was
  leaking).
- Internal OAuth helper no longer logs request arguments (which included the
  `Authorization` header) when the server URL is missing.

## 1.0.0

Initial release of the **framework-agnostic** core SDK, split out from
[`@feelrobotics/keon-wifi-sdk-react`](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk-react)
(≤ 0.3.0). React is no longer a dependency — a separate
[`@feelrobotics/keon-wifi-sdk-react`](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk-react)
package provides the `useKeonWiFi` hook.

### Architecture

Built on **two orthogonal axes**:

- **Transport managers**, each implementing the common **`KeonController`**
  interface (`moveTo`, `movementBetween`, `stop`, `getStatus`, `disconnect`):
  - **`BleManager.connect()`** — direct Web Bluetooth: provisioning + motor
    control + battery + position notifications (`BleController`). Browser-only.
  - **`WifiManager.connect(feelAppsToken, registrationToken, callbacks?)`** —
    Socket.IO to the FEC server; status is pushed (`RemoteController`).
  - **`FugManager.connect({ deviceConnectionKey, … })`** — REST to the Feel
    Unified Gateway; status is pulled. Authenticated with
    `Authorization: DCK <deviceConnectionKey>` (`RemoteController`).
- **Pluggable device drivers** for **KEON WIFI** and **KEON2**, selected
  automatically from the chosen Bluetooth device, so device versions are
  transparent to consumers. Exposed via `DRIVERS`, `matchDriver`,
  `requestDeviceOptions`. Adding a device is one driver file plus one registry line.

`RemoteController` adds `setIntensity`, `setStatusInterval`, `switchToBtMode`,
`resetCredentials`, `forceStatusReport`; `BleController` adds `provision`,
`getBattery`, `testDevice`, `onPosition`, `deviceInfo`.

### Other changes from `@feelrobotics/keon-wifi-sdk-react` (≤ 0.3.0)

- **Package split** `@feelrobotics/keon-wifi-sdk-react` → **`@feelrobotics/keon-wifi-sdk`**.
- **`getTokenForKeonWiFi`** now returns an object and **throws** on failure
  instead of returning `[null, null]`.
- Typed error hierarchy: `KeonError` → `AuthError`, `KeonBLEError`,
  `KeonProvisioningError`.
- Minimum Node.js raised to **18**.

### Internal

- Build tooling migrated to **tsup** (ESM + CJS + `.d.ts`, `exports` field).
- Fixed exported identifier typo `tranformDataToArray` → `transformDataToArray`.
- Removed debug logging from library code.
