import React, { useState } from "react";
import { useKeonWiFi } from "@feelrobotics/keon-wifi-sdk-react";
import type {
  RemoteController,
  KeonDeviceStatus,
} from "@feelrobotics/keon-wifi-sdk";
import "./App.css";

// FUG transport needs only a deviceConnectionKey — no partner token — so we pass
// an empty string to the hook (connectFug ignores it).
export default function App() {
  const keon = useKeonWiFi("");
  const controller = keon.controller as RemoteController | null;
  const connected = controller !== null;

  const [dck, setDck] = useState("");
  const [pollSec, setPollSec] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Movement
  const [speed, setSpeed] = useState(50);
  const [position, setPosition] = useState(50);
  const [betweenSpeed, setBetweenSpeed] = useState(50);
  const [minPos, setMinPos] = useState(0);
  const [maxPos, setMaxPos] = useState(100);
  // Settings
  const [intensity, setIntensity] = useState(50);
  const [statusInterval, setStatusInterval] = useState(200);

  const run = (fn: () => Promise<void>) => async () => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const connect = run(async () => {
    if (!dck.trim()) throw new Error("Enter a deviceConnectionKey");
    const mgr = await keon.connectFug({
      deviceConnectionKey: dck.trim(),
      statusPollIntervalSec: pollSec,
    });
    // The SDK doesn't fetch on connect; pull the initial status ourselves.
    await mgr.forceStatusReport();
  });

  const need = () => {
    if (!controller) throw new Error("Not connected");
    return controller;
  };

  const confirmThen = (message: string, fn: () => Promise<void>) => () => {
    if (window.confirm(message)) run(fn)();
  };

  return (
    <div className="app">
      <header>
        <h1>Keon FUG Console</h1>
        <span className={connected ? "badge on" : "badge"}>
          {connected ? "connected" : "disconnected"}
        </span>
      </header>

      <section className="card">
        <h2>Connection</h2>
        <p className="hint">
          FUG controls an <strong>already-provisioned</strong> device. Get a{" "}
          <code>deviceConnectionKey</code> from the FeelConnect app (or a{" "}
          <code>classic/</code> provisioning example).
        </p>
        <label>
          deviceConnectionKey
          <input
            value={dck}
            onChange={(e) => setDck(e.target.value)}
            placeholder="DCK"
            disabled={connected}
          />
        </label>
        <label>
          status poll (seconds, 0 = off)
          <input
            type="number"
            value={pollSec}
            onChange={(e) => setPollSec(Number(e.target.value))}
            disabled={connected}
          />
        </label>
        {connected ? (
          <button onClick={() => keon.disconnect()}>Disconnect</button>
        ) : (
          <button onClick={connect} disabled={busy}>
            Connect
          </button>
        )}
      </section>

      <section className="card" data-disabled={!connected}>
        <h2>Movement</h2>
        <Slider label="speed" value={speed} onChange={setSpeed} />
        <Slider label="position" value={position} onChange={setPosition} />
        <button
          disabled={!connected || busy}
          onClick={run(() => need().moveTo(speed, position))}
        >
          Move to
        </button>

        <Slider
          label="between speed"
          value={betweenSpeed}
          onChange={setBetweenSpeed}
        />
        <Slider label="min" value={minPos} onChange={setMinPos} />
        <Slider label="max" value={maxPos} onChange={setMaxPos} />
        <button
          disabled={!connected || busy}
          onClick={run(() =>
            need().movementBetween(betweenSpeed, minPos, maxPos),
          )}
        >
          Movement between
        </button>

        <button
          className="danger"
          disabled={!connected || busy}
          onClick={run(() => need().stop())}
        >
          Stop
        </button>
      </section>

      <section className="card" data-disabled={!connected}>
        <h2>Settings</h2>
        <Slider
          label="intensity %"
          value={intensity}
          onChange={setIntensity}
          max={100}
        />
        <button
          disabled={!connected || busy}
          onClick={run(() => need().setIntensity(intensity))}
        >
          Set intensity
        </button>
        <Slider
          label="status interval"
          value={statusInterval}
          onChange={setStatusInterval}
          max={1000}
        />
        <button
          disabled={!connected || busy}
          onClick={run(() => need().setStatusInterval(statusInterval))}
        >
          Set status interval
        </button>
      </section>

      <section className="card" data-disabled={!connected}>
        <h2>Reprovision</h2>
        <div className="row">
          <button
            className="danger"
            disabled={!connected || busy}
            onClick={confirmThen(
              "Drop WiFi and return to Bluetooth mode?",
              () => need().switchToBtMode(),
            )}
          >
            Switch to BT mode
          </button>
          <button
            className="danger"
            disabled={!connected || busy}
            onClick={confirmThen(
              "Wipe stored WiFi credentials on the device?",
              () => need().resetCredentials(),
            )}
          >
            Reset credentials
          </button>
        </div>
      </section>

      <section className="card" data-disabled={!connected}>
        <h2>Status</h2>
        <button
          className="ghost"
          disabled={!connected || busy}
          onClick={run(() => need().forceStatusReport())}
        >
          Force status report
        </button>
        <StatusView statuses={keon.statuses} />
      </section>

      {error && <div className="error">{error}</div>}
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  const max = props.max ?? 100;
  return (
    <label className="slider">
      <span>
        {props.label}: {props.value}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

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

function StatusView({ statuses }: { statuses: KeonDeviceStatus[] }) {
  if (statuses.length === 0)
    return <p className="hint">No status yet — connect to a device.</p>;
  return (
    <>
      {statuses.map((status, i) => (
        <div className="device" key={status.serial_number || i}>
          {statuses.length > 1 && (
            <h3>{status.serial_number || `Device ${i + 1}`}</h3>
          )}
          <div className="metrics">
            {Object.entries(status).map(([key, value]) => (
              <div className="metric" key={key}>
                <span className="k">{STATUS_LABELS[key] ?? key}</span>
                <span className="v">
                  {String(value)}
                  {STATUS_UNITS[key] && (
                    <span className="u">{STATUS_UNITS[key]}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
