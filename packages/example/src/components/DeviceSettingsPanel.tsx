import React, { useState } from "react";
import { KeonManager } from "@feelrobotics/keon-wifi-sdk-react/dist/socketio/keonManager";

interface DeviceSettingsPanelProps {
  keonManager: KeonManager | null;
  isConnected: boolean;
}

const DEFAULT_STATUS_INTERVAL = 30; // seconds

const DeviceSettingsPanel: React.FC<DeviceSettingsPanelProps> = ({
  keonManager,
  isConnected,
}) => {
  const [intensity, setIntensity] = useState<number>(3);
  const [statusInterval, setStatusInterval] = useState<number>(DEFAULT_STATUS_INTERVAL);

  async function send_intensity_to_devices() {
    if (!keonManager) {
      console.error("Please login to the server first!");
      return;
    }

    await keonManager.setIntensityAdjustment(intensity);
  }

  async function send_interval_for_status() {
    if (!keonManager) {
      console.error("Please login to the server first!");
      return;
    }

    keonManager.setIntervalForUpdatingStatus(statusInterval);
  }

  // This function was removed as setIntervalForCommand doesn't exist in KeonManager API

  async function send_status_report_to_devices() {
    if (!keonManager) {
      console.error("Please login to the server first!");
      return;
    }
    await keonManager.forceStatusReport();
  }

  return (
    <div className="settings-section">
      <h3>Device Settings</h3>

      <div className="setting-group">
        <label className="input-label">Intensity</label>
        <div className="input-with-button">
          <input
            type="number"
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            min="0"
            max="5"
            step="1"
          />
          <button onClick={send_intensity_to_devices} disabled={!isConnected}>
            Set Intensity
          </button>
        </div>
      </div>

      <div className="setting-group">
        <label className="input-label">Status Interval (seconds)</label>
        <div className="input-with-button">
          <input
            type="number"
            value={statusInterval}
            onChange={(e) => setStatusInterval(Number(e.target.value))}
            min="1"
          />
          <button onClick={send_interval_for_status} disabled={!isConnected}>
            Set Status Interval
          </button>
        </div>
      </div>

      {/* Command Interval UI was removed as setIntervalForCommand doesn't exist in KeonManager API */}

      <div className="button-row">
        <button
          onClick={send_status_report_to_devices}
          disabled={!isConnected}
          className="service-button"
        >
          Force Status Report
        </button>
      </div>
    </div>
  );
};

export default DeviceSettingsPanel;
