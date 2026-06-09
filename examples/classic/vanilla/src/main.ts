import {
  getTokenForKeonWiFi,
  BleManager,
  WifiManager,
  KeonError,
} from "@feelrobotics/keon-wifi-sdk";
import type {
  RemoteController,
  KeonDeviceStatus,
  KeonProvisioningEvent,
} from "@feelrobotics/keon-wifi-sdk";
import "./app.css";

// ControlPlane base URL that issues the partner token.
// Override via VITE_CP_SERVER_URL in .env.
const CP_SERVER_URL =
  import.meta.env.VITE_CP_SERVER_URL || "https://api.feel-app.com";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id).value.trim();
const num = (id: string) => Number($<HTMLInputElement>(id).value);

const alertBox = $("alert");
function notify(message: string, kind: "error" | "success") {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${kind}`;
  alertBox.style.display = "block";
}
function clearAlert() {
  alertBox.style.display = "none";
}
const reportError = (e: unknown, prefix = "") =>
  notify(`${prefix}${e instanceof KeonError ? e.message : String(e)}`, "error");

let feelToken: string | null = null;
let registrationToken: string | null = null;
let manager: RemoteController | null = null;
let provisioningEvents: KeonProvisioningEvent[] = [];

type ProvisioningEventGroup = KeonProvisioningEvent & { count: number };

// Buttons that require an active connection.
const controlButtons = [
  "moveTo",
  "moveBetween",
  "stop",
  "setIntensity",
  "setInterval",
  "forceStatus",
];
function setControlsEnabled(enabled: boolean) {
  for (const id of controlButtons) {
    $<HTMLButtonElement>(id).disabled = !enabled;
  }
}

const provisioningEventKey = (event: KeonProvisioningEvent) =>
  event.stage === "token" && event.source === "sdk"
    ? "token-sdk-progress"
    : [
        event.stage,
        event.source,
        event.status,
        event.code ?? "",
        event.message,
      ].join("|");

function groupProvisioningEvents(
  events: KeonProvisioningEvent[],
): ProvisioningEventGroup[] {
  return events.reduce<ProvisioningEventGroup[]>((groups, event) => {
    const last = groups.at(-1);
    if (last && provisioningEventKey(last) === provisioningEventKey(event)) {
      groups[groups.length - 1] = { ...event, count: last.count + 1 };
      return groups;
    }
    groups.push({ ...event, count: 1 });
    return groups;
  }, []);
}

function renderProvisioningLog() {
  const wrap = $("provisioningLogWrap");
  const list = $("provisioningLog");
  list.replaceChildren();
  wrap.style.display = provisioningEvents.length ? "block" : "none";

  for (const event of groupProvisioningEvents(provisioningEvents)) {
    const row = document.createElement("div");
    row.className = `provisioning-event status-${event.status}`;

    const main = document.createElement("div");
    main.className = "provisioning-event-main";
    const stage = document.createElement("span");
    stage.textContent = event.stage;
    const status = document.createElement("span");
    status.textContent = event.status;
    if (event.count > 1) {
      const count = document.createElement("span");
      count.className = "provisioning-count";
      count.textContent = `x${event.count}`;
      status.append(count);
    }
    main.append(stage, status);

    const message = document.createElement("div");
    message.className = "provisioning-event-message";
    message.textContent = event.message;

    const progress =
      event.stage === "token" &&
      event.source === "sdk" &&
      event.chunkIndex &&
      event.chunkTotal
        ? document.createElement("div")
        : null;
    if (progress && event.chunkIndex && event.chunkTotal) {
      progress.className = "provisioning-progress";
      const bar = document.createElement("div");
      bar.style.width = `${(event.chunkIndex / event.chunkTotal) * 100}%`;
      progress.append(bar);
    }

    const meta = document.createElement("div");
    meta.className = "provisioning-event-meta";
    meta.textContent = [
      event.source,
      event.code !== undefined ? `code ${event.code}` : "",
      event.rawValue?.length ? `raw [${event.rawValue.join(", ")}]` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    row.append(main, message);
    if (progress) {
      row.append(progress);
    }
    row.append(meta);
    list.append(row);
  }
}

function addProvisioningEvent(event: KeonProvisioningEvent) {
  provisioningEvents = [...provisioningEvents, event];
  renderProvisioningLog();
}

// --- 1. Authentication ---
$("authenticate").addEventListener("click", () => {
  const partnerKey = input("partnerKey");
  if (!partnerKey) {
    notify("Please enter your Partner Key", "error");
    return;
  }
  clearAlert();
  const userId = input("userId");
  const base = CP_SERVER_URL.replace(/\/+$/, "");
  const url = `${base}/api/v1/partner/${encodeURIComponent(partnerKey)}/token${
    userId ? `?user=${userId}` : ""
  }`;
  window.open(url, "_blank", "noopener,noreferrer");
});

$("submitToken").addEventListener("click", async () => {
  const token = input("token");
  if (!token) {
    notify("Please paste the token from the opened tab", "error");
    return;
  }
  clearAlert();
  try {
    feelToken = token;
    const { registrationToken: rt, deviceConnectionKey } =
      await getTokenForKeonWiFi(token, input("deviceKey") || null);
    registrationToken = rt;
    $<HTMLInputElement>("deviceKey").value = deviceConnectionKey;
    $<HTMLButtonElement>("provision").disabled = false;
    $("controlCard").style.display = "block";
    notify(
      `Token accepted. Device connection key: ${deviceConnectionKey}`,
      "success",
    );
  } catch (e) {
    reportError(e, "Failed to process token: ");
  }
});

// --- Password visibility ---
$("togglePassword").addEventListener("click", () => {
  const field = $<HTMLInputElement>("password");
  const show = field.type === "password";
  field.type = show ? "text" : "password";
  $("togglePassword").textContent = show ? "🙈" : "👁️";
});

// --- 2. Provisioning ---
$("provision").addEventListener("click", async () => {
  if (!registrationToken) {
    notify("Get a token first", "error");
    return;
  }
  const ssid = input("ssid");
  const password = $<HTMLInputElement>("password").value;
  if (!ssid || !password) {
    notify("Enter both WiFi name and password", "error");
    return;
  }
  clearAlert();
  provisioningEvents = [];
  renderProvisioningLog();
  try {
    const ble = await BleManager.connect();
    let device;
    try {
      await ble.provision(ssid, password, registrationToken, {
        onStatus: addProvisioningEvent,
        postProvisionListenUntilDisconnect: true,
      });
      device = ble.deviceInfo;
    } finally {
      await ble.disconnect();
    }
    $("deviceData").textContent = JSON.stringify(device, null, 2);
    $("deviceDataWrap").style.display = "block";
    notify("Device provisioned successfully!", "success");
  } catch (e) {
    reportError(e, "Provisioning failed: ");
  }
});

// --- 3. Control: connection ---
function renderStatus(statuses: KeonDeviceStatus[]) {
  // A connection can cover several devices — render one grid per device.
  $("statusWrap").innerHTML = statuses
    .map((status) => {
      const items = Object.entries(status)
        .map(
          ([k, v]) =>
            `<div class="status-item"><div class="k">${k}</div><div class="v">${v}</div></div>`,
        )
        .join("");
      return `<div class="status-grid">${items}</div>`;
    })
    .join("");
}

$("connect").addEventListener("click", async () => {
  if (!feelToken || !registrationToken) {
    notify("Get a token first", "error");
    return;
  }
  clearAlert();
  try {
    manager = await WifiManager.connect(feelToken, registrationToken, {
      onStatusChange: renderStatus,
    });
    $("connect").style.display = "none";
    $("disconnect").style.display = "";
    $("connDot").className = "dot dot-on";
    setControlsEnabled(true);
    notify("Connected to the control server.", "success");
  } catch (e) {
    reportError(e, "Connection failed: ");
  }
});

$("disconnect").addEventListener("click", async () => {
  try {
    await manager?.disconnect();
  } catch (e) {
    reportError(e);
  }
  manager = null;
  $("connect").style.display = "";
  $("disconnect").style.display = "none";
  $("connDot").className = "dot dot-off";
  $("statusWrap").innerHTML = "";
  setControlsEnabled(false);
  notify("Disconnected.", "success");
});

// --- 3. Control: commands ---
$("moveTo").addEventListener("click", () =>
  manager?.moveTo(num("moveSpeed"), num("movePosition")),
);
$("moveBetween").addEventListener("click", () =>
  manager?.movementBetween(num("mbSpeed"), num("mbMin"), num("mbMax")),
);
$("stop").addEventListener("click", () => manager?.stop());
$("setIntensity").addEventListener("click", () =>
  manager?.setIntensity(num("intensity")),
);
$("setInterval").addEventListener("click", () =>
  manager?.setStatusInterval(num("statusInterval")),
);
$("forceStatus").addEventListener("click", () => manager?.forceStatusReport());
