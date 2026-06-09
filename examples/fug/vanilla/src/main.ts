import { FugManager } from "@feelrobotics/keon-wifi-sdk";
import type { KeonDeviceStatus } from "@feelrobotics/keon-wifi-sdk";
import "./app.css";

// FUG controls an already-provisioned device with only a deviceConnectionKey.
let manager: FugManager | null = null;

// Friendly labels and units for the raw device-status keys.
const STATUS_LABELS: Record<string, string> = {
  battery_status: "Battery",
  wifi_strength: "Wi-Fi",
  motor_speed: "Motor speed",
  encoder_pos: "Position",
  intensity: "Intensity",
  stroker_level: "Stroker level",
  error_code: "Error",
  firmware_version: "Firmware",
  serial_number: "Serial",
  status_package: "Status",
  status_period: "Status interval",
  ble_address: "BLE address",
};
const STATUS_UNITS: Record<string, string> = { battery_status: "%" };

const slider = (id: string, label: string, value: number, max: number) =>
  `<label class="slider"><span>${label}: <b id="${id}Val">${value}</b></span>
   <input type="range" id="${id}" min="0" max="${max}" value="${value}" /></label>`;

const app = document.getElementById("app")!;
app.className = "app";
app.innerHTML = `
  <header>
    <h1>Keon FUG Console</h1>
    <span id="badge" class="badge">disconnected</span>
  </header>

  <section class="card">
    <h2>Connection</h2>
    <p class="hint">FUG controls an <strong>already-provisioned</strong> device.
      Get a <code>deviceConnectionKey</code> from the FeelConnect app (or a
      <code>classic/</code> provisioning example).</p>
    <label>deviceConnectionKey<input id="dck" placeholder="DCK" /></label>
    <label>status poll (seconds, 0 = off)<input id="pollSec" type="number" value="30" /></label>
    <button id="connect">Connect</button>
    <button id="disconnect" class="danger" style="display:none">Disconnect</button>
  </section>

  <section class="card cmd-card" data-disabled="true">
    <h2>Movement</h2>
    ${slider("speed", "speed", 50, 100)}
    ${slider("position", "position", 50, 100)}
    <button class="cmd" id="moveTo" disabled>Move to</button>
    ${slider("betweenSpeed", "between speed", 50, 100)}
    ${slider("minPos", "min", 0, 100)}
    ${slider("maxPos", "max", 100, 100)}
    <button class="cmd" id="moveBetween" disabled>Movement between</button>
    <button class="cmd danger" id="stop" disabled>Stop</button>
  </section>

  <section class="card cmd-card" data-disabled="true">
    <h2>Settings</h2>
    ${slider("intensity", "intensity %", 50, 100)}
    <button class="cmd" id="setIntensity" disabled>Set intensity</button>
    ${slider("statusInterval", "status interval", 200, 1000)}
    <button class="cmd" id="setStatusInterval" disabled>Set status interval</button>
  </section>

  <section class="card cmd-card" data-disabled="true">
    <h2>Reprovision</h2>
    <div class="row">
      <button class="cmd danger" id="switchToBt" disabled>Switch to BT mode</button>
      <button class="cmd danger" id="resetCreds" disabled>Reset credentials</button>
    </div>
  </section>

  <section class="card cmd-card" data-disabled="true">
    <h2>Status</h2>
    <button class="cmd ghost" id="forceStatus" disabled>Force status report</button>
    <div id="status"><p class="hint">No status yet — connect to a device.</p></div>
  </section>

  <div id="error" class="error" style="display:none"></div>
`;

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const num = (id: string) => Number(el<HTMLInputElement>(id).value);

// Live slider value labels.
for (const id of [
  "speed",
  "position",
  "betweenSpeed",
  "minPos",
  "maxPos",
  "intensity",
  "statusInterval",
]) {
  const input = el<HTMLInputElement>(id);
  input.addEventListener("input", () => {
    el(`${id}Val`).textContent = input.value;
  });
}

const errorBox = el<HTMLDivElement>("error");
const run = async (fn: () => Promise<void>) => {
  errorBox.style.display = "none";
  try {
    await fn();
  } catch (e) {
    errorBox.textContent = String(e);
    errorBox.style.display = "block";
  }
};

const need = (): FugManager => {
  if (!manager) throw new Error("Not connected");
  return manager;
};

const confirmThen = (message: string, fn: () => Promise<void>) => {
  if (window.confirm(message)) void run(fn);
};

function setConnected(on: boolean) {
  el("badge").textContent = on ? "connected" : "disconnected";
  el("badge").className = on ? "badge on" : "badge";
  el("connect").style.display = on ? "none" : "";
  el("disconnect").style.display = on ? "" : "none";
  document
    .querySelectorAll<HTMLElement>(".cmd-card")
    .forEach((c) => c.setAttribute("data-disabled", String(!on)));
  document
    .querySelectorAll<HTMLButtonElement>(".cmd")
    .forEach((b) => (b.disabled = !on));
}

function renderStatus(statuses: KeonDeviceStatus[]) {
  if (statuses.length === 0) {
    el("status").innerHTML =
      '<p class="hint">No status yet — connect to a device.</p>';
    return;
  }
  el("status").innerHTML = statuses
    .map((status, i) => {
      const heading =
        statuses.length > 1
          ? `<h3>${status.serial_number || `Device ${i + 1}`}</h3>`
          : "";
      const metrics = Object.entries(status)
        .map(([k, v]) => {
          const unit = STATUS_UNITS[k]
            ? `<span class="u">${STATUS_UNITS[k]}</span>`
            : "";
          return `<div class="metric"><span class="k">${STATUS_LABELS[k] ?? k}</span><span class="v">${String(v)}${unit}</span></div>`;
        })
        .join("");
      return `<div class="device">${heading}<div class="metrics">${metrics}</div></div>`;
    })
    .join("");
}

el("connect").addEventListener("click", () =>
  run(async () => {
    const dck = el<HTMLInputElement>("dck").value.trim();
    if (!dck) throw new Error("Enter a deviceConnectionKey");
    const pollSec = num("pollSec");
    manager = await FugManager.connect({
      deviceConnectionKey: dck,
      statusPollIntervalSec: pollSec,
      onStatusChange: renderStatus,
    });
    setConnected(true);
    // The SDK doesn't fetch on connect; pull the initial status ourselves.
    await manager.forceStatusReport();
  }),
);

el("disconnect").addEventListener("click", () =>
  run(async () => {
    await manager?.disconnect();
    manager = null;
    setConnected(false);
  }),
);

el("moveTo").addEventListener("click", () =>
  run(() => need().moveTo(num("speed"), num("position"))),
);
el("moveBetween").addEventListener("click", () =>
  run(() =>
    need().movementBetween(num("betweenSpeed"), num("minPos"), num("maxPos")),
  ),
);
el("stop").addEventListener("click", () => run(() => need().stop()));
el("setIntensity").addEventListener("click", () =>
  run(() => need().setIntensity(num("intensity"))),
);
el("setStatusInterval").addEventListener("click", () =>
  run(() => need().setStatusInterval(num("statusInterval"))),
);
el("switchToBt").addEventListener("click", () =>
  confirmThen("Drop WiFi and return to Bluetooth mode?", () =>
    need().switchToBtMode(),
  ),
);
el("resetCreds").addEventListener("click", () =>
  confirmThen("Wipe stored WiFi credentials on the device?", () =>
    need().resetCredentials(),
  ),
);
el("forceStatus").addEventListener("click", () =>
  run(() => need().forceStatusReport()),
);
