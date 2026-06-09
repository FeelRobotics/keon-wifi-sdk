# Keon WiFi SDK — Svelte 5 example

Vite + Svelte 5 demo of the full SDK flow: authenticate, provision over
Bluetooth, then control the device with live status via `onStatusChange`.

> Provisioning requires the Web Bluetooth API (Chrome/Edge/Opera, https/localhost).

## Run

```sh
yarn install      # from the repo root
yarn dev:svelte   # builds the libs, then starts the example
```

## Flow

1. **Authenticate** — enter your Partner Key + User ID and click _Authenticate_.
   A new tab opens with the partner token; copy it and paste it into the **Token**
   field, then **Submit Token**. This example flow simulates server-to-server
   token issuance; production browser apps should obtain the partner token from
   their backend and must not expose the partner key in the client bundle.
2. **Provision** — enter the WiFi SSID/password and click _Provision Device_
   (a Bluetooth device picker appears).
3. **Control** — _Connect to Server_, then drive the device (Move To / Move
   Between / intensity / status interval) and watch live status.
