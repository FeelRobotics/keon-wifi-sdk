# Keon WiFi SDK

This repository contains the Keon WiFi SDK (`@feelgroup/keon-wifi-sdk-react`) and a React-based example application demonstrating its usage. It is structured as a monorepo with two packages:

* **packages/sdk**: The TypeScript SDK for connecting to and provisioning Keon WiFi devices.
* **packages/example**: A React application showcasing how to integrate and use the SDK.

---

## Table of Contents

* [Prerequisites](#prerequisites)
* [Monorepo Structure](#monorepo-structure)
* [Getting Started](#getting-started)

  * [1. Install Dependencies](#1-install-dependencies)
  * [2. Build the SDK](#2-build-the-sdk)
  * [3. Run the Example App](#3-run-the-example-app)
* [Usage](#usage)

  * [Importing the SDK](#importing-the-sdk)
  * [Key Functions](#key-functions)
* [Development Workflow](#development-workflow)

  * [Adding Features or Fixes](#adding-features-or-fixes)
  * [Running Tests](#running-tests)
  * [Linting and Formatting](#linting-and-formatting)
* [Publishing the SDK](#publishing-the-sdk)
* [Contributing](#contributing)
* [License](#license)

---

## Prerequisites

* Node.js v14+ (recommended)
* Yarn v2+ (Berry) configured with `node-modules` linker
* Git (for version control and workflow)

---

## Monorepo Structure

```text
keon-wifi-sdk-react/
+-- .yarn/               # Yarn v2+ binaries and cache
+-- packages/
¦   +-- sdk/             # SDK package
¦   ¦   +-- dist/        # Compiled JS output
¦   ¦   +-- src/         # TypeScript source files
¦   ¦   +-- package.json
¦   ¦   +-- tsconfig.json
¦   +-- example/         # React example app
¦       +-- public/
¦       +-- src/
¦       +-- package.json
¦       +-- tsconfig.json
+-- .gitignore
+-- .yarnrc.yml          # Yarn v2+ configuration
+-- package.json         # Root workspace config
+-- yarn.lock
```

---

## Getting Started

Follow these steps to install, build, and run both the SDK and the example application.

### 1. Install Dependencies

From the root of the repository, run:

```bash
yarn install
```

This will install dependencies for both the `sdk` and the `example` packages.

### 2. Build the SDK

Compile the SDK source into the `dist/` folder:

```bash
yarn build:sdk
```

This runs the `build` script defined in `packages/sdk/package.json`.

### 3. Run the Example App

Start the React development server for the example application:

```bash
yarn start:example
```

Open your browser at `http://localhost:3000` to see the example app in action.
