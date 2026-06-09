import React, { useState } from "react";
import {
  getTokenForKeonWiFi,
  BleManager,
  useKeonWiFi,
} from "@feelrobotics/keon-wifi-sdk-react";
import type { KeonProvisioningEvent } from "@feelrobotics/keon-wifi-sdk-react";
import { CustomerPanel } from "./components/CustomerPanel";
import "./App.css";

// Base API URL for FeelApps (ControlPlane — issues the partner token).
// Override via VITE_CP_SERVER_URL in .env.
const CP_SERVER_URL =
  import.meta.env.VITE_CP_SERVER_URL || "https://api.feel-app.com";

type ProvisioningEventGroup = KeonProvisioningEvent & { count: number };

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

const groupProvisioningEvents = (
  events: KeonProvisioningEvent[],
): ProvisioningEventGroup[] =>
  events.reduce<ProvisioningEventGroup[]>((groups, event) => {
    const last = groups.at(-1);
    if (last && provisioningEventKey(last) === provisioningEventKey(event)) {
      groups[groups.length - 1] = { ...event, count: last.count + 1 };
      return groups;
    }
    groups.push({ ...event, count: 1 });
    return groups;
  }, []);

function App() {
  // State management
  const [partnerKey, setPartnerKey] = useState("");
  const [userId, setUserId] = useState<number>(8059); // Default userId
  const [manualToken, setManualToken] = useState(""); // For manual token input
  const [feelToken, setFeelToken] = useState("");
  const [registrationToken, setRegistrationToken] = useState<string | null>(
    null,
  );
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // For password visibility toggle
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deviceData, setDeviceData] = useState<any>(null);
  const [provisioningEvents, setProvisioningEvents] = useState<
    KeonProvisioningEvent[]
  >([]);

  // SDK React hook — owns the manager lifecycle (connect/close on unmount) and
  // pushes live device status via onStatusChange.
  const keon = useKeonWiFi(feelToken);
  const provisioningEventGroups = groupProvisioningEvents(provisioningEvents);

  // Open API request in a new tab
  const openRequestInNewTab = (
    baseUrl: string,
    partnerKey: string,
    userId?: string,
  ) => {
    const base = baseUrl.replace(/\/+$/, "");
    const u = new URL(
      `${base}/api/v1/partner/${encodeURIComponent(partnerKey)}/token${userId ? `?user=${userId}` : ""}`,
    );
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  };

  // Show token input and open request in new tab
  const handleLogin = () => {
    if (!partnerKey) {
      setError("Please enter your Partner Key");
      return;
    }

    setError(null);
    setSuccess(null);

    // Open the request URL in a new tab
    openRequestInNewTab(CP_SERVER_URL, partnerKey, userId.toString());
  };

  // Process the manually entered token
  const handleTokenSubmit = async () => {
    if (!manualToken) {
      setError("Please enter the token");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Use the manually entered token
      setFeelToken(manualToken);

      // Retrieve registration token and device key
      const { registrationToken: regToken, deviceConnectionKey: devKey } =
        await getTokenForKeonWiFi(manualToken, deviceKey || null);
      setRegistrationToken(regToken);
      setDeviceKey(devKey);
      setSuccess(`Successfully retrieved token and device key: ${devKey}`);
    } catch (err) {
      console.error("Error processing token:", err);
      setError(
        "Failed to process token. Please check the token value and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect and clear all tokens and credentials
  const handleDisconnect = () => {
    // Close the manager connection via the hook.
    keon.disconnect();

    // Clear all tokens and keys
    setFeelToken("");
    setRegistrationToken(null);
    setDeviceKey(null);
    setManualToken("");

    // Clear error and success messages
    setError(null);
    setSuccess("Successfully disconnected");
  };

  // Connect and provision the device
  const handleProvision = async () => {
    if (!registrationToken) {
      setError("Please login and get tokens first");
      return;
    }

    if (!ssid || !password) {
      setError("Please enter both WiFi SSID and password");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setProvisioningEvents([]);

    const addProvisioningEvent = (event: KeonProvisioningEvent) => {
      setProvisioningEvents((events) => [...events, event]);
    };

    try {
      // Provision over BLE: pick the device, write credentials, disconnect.
      // BleManager auto-detects the device generation (KEON WIFI / KEON2).
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

      setDeviceData(device);
      setSuccess("Device provisioned successfully!");
    } catch (err) {
      console.error("Error during provisioning:", err);
      setError(`Provisioning failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Keon WiFi SDK</h1>
      </header>

      <div className="card">
        <h2 className="section-title">Authentication</h2>
        <div className="input-row">
          <div className="input-group">
            <label className="input-label">Partner Key</label>
            <input
              type="text"
              placeholder="Enter your partner key"
              value={partnerKey}
              onChange={(e) => setPartnerKey(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">User ID</label>
            <input
              type="number"
              placeholder="Enter user ID"
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="input-group">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="auth-button"
          >
            {isLoading ? "Loading..." : "Authenticate"}
          </button>
        </div>

        <div className="input-group">
          <label className="input-label">Device Connection Key</label>
          <div style={{ display: "flex" }}>
            <input
              type="text"
              placeholder="Device connection key (8 characters)"
              value={deviceKey || ""}
              onChange={(e) => setDeviceKey(e.target.value)}
              maxLength={8}
              style={{
                width: "12ch",
                minWidth: "12ch",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div className="input-group token-input">
          <label className="input-label">Token</label>
          <div
            style={{ display: "flex", width: "100%", flexDirection: "column" }}
          >
            <textarea
              placeholder="Paste token from opened tab"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              style={{
                width: "90%",
                boxSizing: "border-box",
                height: "80px",
                fontFamily: "monospace",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: "90%",
              }}
            >
              <button
                onClick={handleTokenSubmit}
                disabled={isLoading || !manualToken}
                style={{ marginTop: "10px" }}
              >
                {isLoading ? "Processing..." : "Submit Token"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="provisioning-container">
        <div className="card">
          <h2 className="section-title">Device Provisioning</h2>
          <div className="input-group">
            <label className="input-label">WiFi SSID</label>
            <input
              type="text"
              placeholder="Enter WiFi name"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              name="wifiSSID"
              id="wifi-ssid"
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label className="input-label">WiFi Password</label>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter WiFi password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                name="wifiPassword"
                id="wifi-password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <button
            onClick={handleProvision}
            className={!registrationToken ? "disabled" : ""}
            disabled={!registrationToken || isLoading}
          >
            {isLoading ? "Provisioning..." : "Provision Device"}
          </button>

          {provisioningEvents.length > 0 && (
            <div className="provisioning-log">
              <div className="provisioning-log-title">Provisioning status</div>
              {provisioningEventGroups.map((event, index) => (
                <div
                  className={`provisioning-event status-${event.status}`}
                  key={`${event.stage}-${event.source}-${index}`}
                >
                  <div className="provisioning-event-main">
                    <span>{event.stage}</span>
                    <span>
                      {event.status}
                      {event.count > 1 ? (
                        <span className="provisioning-count">
                          x{event.count}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="provisioning-event-message">
                    {event.message}
                  </div>
                  {event.stage === "token" &&
                    event.source === "sdk" &&
                    event.chunkIndex &&
                    event.chunkTotal && (
                      <div className="provisioning-progress">
                        <div
                          style={{
                            width: `${
                              (event.chunkIndex / event.chunkTotal) * 100
                            }%`,
                          }}
                        />
                      </div>
                    )}
                  <div className="provisioning-event-meta">
                    {event.source}
                    {event.code !== undefined ? ` · code ${event.code}` : ""}
                    {event.rawValue?.length
                      ? ` · raw [${event.rawValue.join(", ")}]`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {deviceData && (
          <div className="card device-data-card">
            <h2 className="section-title">Device Data</h2>
            <div className="device-data-content">
              <pre>{JSON.stringify(deviceData, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      {(error || success) && (
        <div className={error ? "error-message" : "success-message"}>
          {error || success}
        </div>
      )}

      {registrationToken && (
        <div className="card">
          <h2 className="section-title">Customer Panel</h2>
          <CustomerPanel
            keon={keon}
            registrationToken={registrationToken}
            onDisconnect={handleDisconnect}
          />
        </div>
      )}
    </div>
  );
}

export default App;
