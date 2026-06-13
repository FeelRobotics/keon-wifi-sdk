# Keon Device Emulator Web

A single-page TypeScript web application that simulates a physical Kiiroo Keon device for partner integration testing with the FeelTechnologies infrastructure.

No framework-specific routing or server-side rendering is needed; the app is a pure client-side SPA.

---

## Quick Start

From the monorepo root:

```bash
yarn install
yarn dev:emulator   # or: yarn workspace keon-emulator-web dev
```

---

## Build & Deploy

### HTTPS production bundle (deploy to server)

```bash
yarn workspace keon-emulator-web build
# Output: dist/
```

Deploy `dist/` behind an HTTPS-capable web server (nginx, Caddy, AWS CloudFront, etc.).

### Local / offline bundle (no server required)

```bash
yarn workspace keon-emulator-web build:local
# Output: dist-local/
npx serve dist-local
```

Uses relative asset paths so the HTML file can be opened directly or served from any directory.

---

## Scripts

| Command                                          | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| `yarn workspace keon-emulator-web dev`           | Vite dev server with HMR                              |
| `yarn workspace keon-emulator-web build`         | Type-check + production bundle → `dist/`              |
| `yarn workspace keon-emulator-web build:local`   | Type-check + local bundle → `dist-local/` (base `./`) |
| `yarn workspace keon-emulator-web preview`       | Preview production bundle locally                     |
| `yarn workspace keon-emulator-web test`          | Run all Vitest unit tests                             |
| `yarn workspace keon-emulator-web test:coverage` | Run tests with V8 coverage report                     |
| `yarn workspace keon-emulator-web lint`          | ESLint (flat config)                                  |
| `yarn workspace keon-emulator-web typecheck`     | TypeScript strict type-check (no emit)                |
| `yarn workspace keon-emulator-web format`        | Prettier format all files                             |

---

## Architecture Overview

```
Browser
  └── App.tsx
        ├── VesselView         — SVG vessel + animated piston line
        ├── ControlPanel
        │     ├── ConnectionKeyInput   — 8-char uppercase DCK field
        │     ├── ProvisioningBlock    — Cognito → OAuth → Socket.IO
        │     └── StatusReadouts       — live intensity / stroker_level
        └── LogConsole         — timestamped bidirectional event log

State layer (Zustand)
  └── appStore.ts
        device: { position, speed, intensity, strokerLevel, battery }
        auth:   { deviceConnectionKey, accessToken, refreshToken }
        ui:     { socketStatus, animationParams, logs }

Transport layer
  └── lib/socket.ts  (KeonSocketTransport)
        ↔ FeelExchangeCenter root namespace "/" via socket.io-client
        ↑ fsu (device status)
        ↓ command_for_device / change_device_settings / change_device_mode /
          request_device_status

Auth layer
  ├── lib/cognito.ts  — direct Cognito USER_PASSWORD_AUTH (no SDK dep)
  ├── lib/oauth.ts    — POST /api/token/access, POST /api/token/refresh
  └── lib/jwtDecode.ts — client-side JWT payload decode (no verify)

Protocol layer
  └── lib/position.ts
        positionToDisplayLevel()  — 15% floor invariant
        parseDeviceCommand()      — KEON string → ParsedDeviceCommand
        parseDeviceSetup()        — KEON string → ParsedDeviceSetup
        parseDeviceReprovision()  — KEON string → ParsedDeviceReprovision
        buildFsuPayload()         — KeonDeviceStatus → { KEON: ... }
```

---

## Provisioning Flow

```
1. User enters email + password
2. POST cognito-idp.{region}.amazonaws.com/  (USER_PASSWORD_AUTH)
   → IdToken, AccessToken, RefreshToken
3. POST {OAUTH_BASE_URL}/api/token/access
   Headers: Authorization: Bearer {IdToken}
   Body:    { device_connection_key?: "GNEU8LJA", data: { sub: email } }
   → { access_token, refresh_token }
4. Decode access_token JWT → extract device_connection_key claim
5. Populate Connection Key field
6. React effect fires on accessToken change → connect Socket.IO
```

---

## Socket.IO Protocol

```
Connection:
  io("https://fec.feelme.com", {
    path: "/socket.io",
    auth: { Authorization: "Bearer <accessToken>" }
  })

Emitted by emulator (device role):
  fsu  →  { KEON: KeonDeviceStatus }

Received by emulator (device role):
  command_for_device      → { KEON: "3 speed pos" | "4 speed min max" | "00", TIME, CD }
  change_device_settings  → { KEON: "00 intensity" | "01 intensity" | "02 interval" }
  change_device_mode      → { KEON: "01" | "02" }
  request_device_status   → (any) — triggers immediate fsu response
```

---

## Testing

```bash
yarn workspace keon-emulator-web test:coverage
# Coverage report at coverage/index.html
# Threshold: 75% lines + branches (enforced in CI)
```

Test files are in `tests/`:

- `appConfig.test.ts` — Vite env to runtime config mapping
- `position.test.ts` — pure math + KEON parser
- `jwtDecode.test.ts` — JWT decode without verify
- `cognito.test.ts` — Cognito auth flow with MSW
- `oauth.test.ts` — OAuth token flow with MSW
- `socket.test.ts` — Socket.IO transport with vi.mock
- `statusPayload.test.ts` — store actions + FSU payload assembly
