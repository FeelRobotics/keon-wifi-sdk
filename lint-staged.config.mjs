import path from "node:path";

// ESLint uses per-package flat configs (packages/*/eslint.config.mjs), which are
// only discovered when ESLint runs with that package as its cwd. So route each
// package's staged files through `yarn workspace … exec`, passing paths relative
// to the workspace. Everything else is format-only.

const root = process.cwd();

const ws = (name, dir) => (files) => {
  const rel = files
    .map((f) => path.relative(path.join(root, dir), f))
    .map((f) => JSON.stringify(f))
    .join(" ");
  return [
    `yarn workspace ${name} exec eslint --fix ${rel}`,
    `yarn workspace ${name} exec prettier --write ${rel}`,
  ];
};

export default {
  "packages/sdk/src/**/*.ts": ws("@feelrobotics/keon-wifi-sdk", "packages/sdk"),
  "packages/react/src/**/*.{ts,tsx}": ws(
    "@feelrobotics/keon-wifi-sdk-react",
    "packages/react",
  ),
  "**/*.{js,jsx,mjs,cjs,json,md,yml,yaml}": "prettier --write",
  "examples/**/*.{ts,tsx}": "prettier --write",
};
