# Contributing

## Setup

This is a Yarn 4 monorepo. Requires Node.js ≥ 18.

```sh
corepack enable
yarn install
```

## Packages

| Path             | Package                             | Description                                                      |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `packages/sdk`   | `@feelrobotics/keon-wifi-sdk`       | Framework-agnostic core SDK.                                     |
| `packages/react` | `@feelrobotics/keon-wifi-sdk-react` | React `useKeonWiFi` hook (depends on core).                      |
| `examples/*`     | —                                   | Runnable demo apps (React, Vue, Svelte, vanilla, Node). Private. |

## Scripts (run from the repo root)

```sh
yarn build        # build the packages (core → react adapter, topological)
yarn build:all    # build packages + all examples
yarn lint         # lint every workspace that defines a lint script
yarn test         # run all test suites (core + emulator)
yarn typecheck    # type-check all packages and examples
yarn size         # check the core bundle-size limit
```

Aggregate scripts use `yarn workspaces foreach`, which auto-discovers workspaces and skips those without the given script.

Per-workspace: `yarn workspace <name> run <script>` (e.g.`yarn workspace keon-classic-vue build`).
To run an example end-to-end use the `dev:*` scripts (`dev:classic:<stack>`, `dev:fug:<stack>`, `dev:emulator`) — they
build the libraries first, then start the app.

> `yarn build` is topologically ordered, so the core is always built before the react adapter.

## Conventions

- TypeScript strict mode; no `console` logging in library code.
- Prettier (single quotes, 80 cols, es5 trailing commas) + ESLint must pass.
- Public API changes go through the SDK's `CHANGELOG.md`.

## Git hooks

Husky installs the hooks automatically on `yarn install` (via the root `prepare` script). Two hooks run locally:

- **pre-commit** → `lint-staged`: ESLint `--fix` + Prettier on the staged files
  only (package sources are linted with their own workspace config; everything
  else is formatted). A real lint error aborts the commit.
- **commit-msg** → `commitlint`: the message must follow
  [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, …).
