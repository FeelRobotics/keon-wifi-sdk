# Keon WiFi SDK

Monorepo for the **Keon WiFi SDK** — a framework-agnostic TypeScript SDK for
controlling Keon devices.

The Keon user puts the device on WiFi with the **FeelConnect app**, which yields a
`deviceConnectionKey` (DCK); the integrating application then controls the device
through this SDK.

Three transports, one common `KeonController` interface — chosen by connection
method:

1. **FUG (`FugManager`) — recommended default.** REST over the Feel Unified
   Gateway with just a `deviceConnectionKey` and HTTP. No Web Bluetooth, no
   in-browser OAuth; runs in any browser **and** in Node/back-end. The best fit
   for most integrations.
2. **WiFi (`WifiManager`) — for real-time.** Socket.IO with pushed, low-latency
   status. Suitable when live, interactive control is required.
3. **BLE (`BleManager`) — fallback.** Direct Web Bluetooth, browser-only.
   Provisioning is normally handled by the FeelConnect app; BLE is reserved as a
   fallback (in-browser provisioning or local control when the FeelConnect app is
   not an option).

## Packages

| Path             | Package                                                         | Description                                 |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------- |
| `packages/sdk`   | [`@feelrobotics/keon-wifi-sdk`](packages/sdk/README.md)         | Framework-agnostic core SDK.                |
| `packages/react` | [`@feelrobotics/keon-wifi-sdk-react`](packages/react/README.md) | React `useKeonWiFi` hook (depends on core). |

## Examples

Runnable example apps live under `examples/`:

Each `dev:*` script builds the packages first, so a single command runs the
example from a clean checkout.

**FUG (recommended)** — control an already-provisioned device over REST with just
a `deviceConnectionKey`:

| Example                | Stack                                 | Run                    |
| ---------------------- | ------------------------------------- | ---------------------- |
| `examples/fug/react`   | React + Vite, FUG REST transport      | `yarn dev:fug:react`   |
| `examples/fug/vue`     | Vue 3 + Vite, FUG REST transport      | `yarn dev:fug:vue`     |
| `examples/fug/svelte`  | Svelte 5 + Vite, FUG REST transport   | `yarn dev:fug:svelte`  |
| `examples/fug/vanilla` | TypeScript + Vite, FUG REST transport | `yarn dev:fug:vanilla` |
| `examples/fug/node`    | Node, FUG REST (control only)         | `yarn dev:fug:node`    |

**Classic (fallback)** — in-browser BLE provisioning + real-time WiFi control:

| Example                    | Stack             | Run                        |
| -------------------------- | ----------------- | -------------------------- |
| `examples/classic/react`   | React + Vite      | `yarn dev:classic:react`   |
| `examples/classic/vue`     | Vue 3 + Vite      | `yarn dev:classic:vue`     |
| `examples/classic/svelte`  | Svelte 5 + Vite   | `yarn dev:classic:svelte`  |
| `examples/classic/vanilla` | TypeScript + Vite | `yarn dev:classic:vanilla` |

**Tooling:**

| Example                      | Stack                        | Run                 |
| ---------------------------- | ---------------------------- | ------------------- |
| `examples/keon-emulator-web` | React + Vite device emulator | `yarn dev:emulator` |

> The classic examples use the **Web Bluetooth API** — browser-only
> (Chrome/Edge/Opera, over `https://` or `localhost`). FUG and WiFi control work
> anywhere, including Node.js. The emulator example does not require physical
> hardware.

## Getting started

Requires Node.js >= 18 and Yarn 4 (via Corepack).

```bash
corepack enable
yarn install
yarn build          # build core, then the react adapter
```

Then run any example, e.g.:

```bash
yarn run dev
```

## Scripts (repo root)

```bash
# whole repo
yarn build        # build the packages (core -> react adapter, topological)
yarn build:all    # build packages + all examples
yarn lint         # lint every workspace that defines a lint script
yarn test         # run all test suites (core + emulator)
yarn typecheck    # type-check all packages and examples
yarn size         # check the core bundle-size limit

# run an example (builds the libs first)
yarn dev                # the FUG React example (alias for dev:fug:react)
yarn dev:classic:react  # ...or any other dev:classic:* / dev:fug:* / dev:emulator

# a single package or example
yarn workspace @feelrobotics/keon-wifi-sdk test
yarn workspace keon-classic-vue build
```

## Documentation

- Core API, token flow, and integration examples: [`packages/sdk/README.md`](packages/sdk/README.md)
- Keon device emulator example: [`examples/keon-emulator-web/README.md`](examples/keon-emulator-web/README.md)
- Changelog & migration from `@feelrobotics/keon-wifi-sdk-react`: [`packages/sdk/CHANGELOG.md`](packages/sdk/CHANGELOG.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## License

MIT
