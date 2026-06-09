# Keon FUG Console — React

A control console for an **already-provisioned** Keon device over the Feel
Unified Gateway (FUG) REST transport. It exercises every device command:
`moveTo`, `movementBetween`, `stop`, `setIntensity`, `setStatusInterval`,
`switchToBtMode`, `resetCredentials`, and pulled status (`forceStatusReport` /
optional polling).

Provisioning is **out of scope** — it needs Web Bluetooth and is handled by the
**FeelConnect** app (or a `classic/` browser example). Those give you a
`deviceConnectionKey` to paste here.

## Run

```sh
yarn install        # from the repo root
yarn dev:fug:react
```

Paste a `deviceConnectionKey`, click **Connect**, and drive the device.
