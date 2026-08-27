# Changelog

## 2.0.0

Tracks `@feelrobotics/keon-wifi-sdk` 2.0.0, which drops WiFi provisioning —
device setup is handled by the **FeelConnect** app.

### BREAKING CHANGES

- Removed `provision()` from `useKeonWiFi`. Fetch tokens with the core SDK's
  `getTokenForKeonWiFi()` and pass the registration token to
  `connectWifi(registrationToken)` instead; FUG connections take the
  `deviceConnectionKey` from FeelConnect.
- Re-exported provisioning types and `KeonProvisioningError` are gone (removed
  from the core SDK).

## 1.0.0

Reworked as a thin React adapter over the framework-agnostic
[`@feelrobotics/keon-wifi-sdk`](https://www.npmjs.com/package/@feelrobotics/keon-wifi-sdk)
core.

### Changed

- Now depends on `@feelrobotics/keon-wifi-sdk` for all device logic; this package
  only provides the `useKeonWiFi` React hook.
- `useKeonWiFi(feelAppsToken)` returns
  `{ controller, status, position, provision, connectBle, connectWifi, connectFug, disconnect }`
  and owns the active controller across all transports (BLE / WiFi / FUG),
  closing the connection automatically on unmount.
- Live device status is delivered via `onStatusChange` (no polling); BLE motor
  position via `onPosition`.
- `react` is a peer dependency (`>=16.8.0`); minimum Node.js raised to **18**.

### Previous versions (0.2.x – 0.3.0)

Earlier releases bundled the full SDK and React together. The framework-agnostic
API now lives in `@feelrobotics/keon-wifi-sdk` — see that package's changelog.
