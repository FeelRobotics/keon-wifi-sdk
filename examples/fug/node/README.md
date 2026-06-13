# Keon WiFi SDK — Node.js example (FUG, headless)

Controls an **already-provisioned** Keon device from Node.js over the Feel Unified Gateway (FUG) REST transport. No browser, no Web Bluetooth, no OAuth — just a `deviceConnectionKey` and HTTP. This is the clearest demonstration that the SDK can drive a device from a server, a CI job, or any backend.

> Provisioning is **out of scope** here — it needs the Web Bluetooth API and is
> browser-only. Provision the device with the **FeelConnect** app (or a
> `classic/` browser example) to obtain a `deviceConnectionKey`, then pass it in.

## Run

```sh
yarn install            # from the repo root
KEON_DEVICE_CONNECTION_KEY=... yarn dev:fug:node
```

On Windows PowerShell:

```powershell
$env:KEON_DEVICE_CONNECTION_KEY="..."
yarn dev:fug:node
```

After connecting it pulls the device status once (`forceStatusReport`), then polls every 2 seconds while sending a few commands, then stops and disconnects.
