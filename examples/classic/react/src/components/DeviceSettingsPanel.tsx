import React, { useState } from "react";
import type { RemoteController } from "@feelrobotics/keon-wifi-sdk-react";

interface DeviceSettingsPanelProps {
  controller: RemoteController | null;
  isConnected: boolean;
}

const DEFAULT_STATUS_INTERVAL = 10; // seconds

const DeviceSettingsPanel: React.FC<DeviceSettingsPanelProps> = ({
  controller,
  isConnected,
}) => {
  const [intensity, setIntensity] = useState<number>(3);
  const [statusInterval, setStatusInterval] = useState<number>(
    DEFAULT_STATUS_INTERVAL,
  );

  async function send_intensity_to_devices() {
    if (!controller) {
      console.error("Please login to the server first!");
      return;
    }

    await controller.setIntensity(intensity);
  }

  async function send_interval_for_status() {
    if (!controller) {
      console.error("Please login to the server first!");
      return;
    }

    controller.setStatusInterval(statusInterval);
  }

  async function send_status_report_to_devices() {
    if (!controller) {
      console.error("Please login to the server first!");
      return;
    }
    await controller.forceStatusReport();
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
            max="10"
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
            min="0"
            max="1000"
            step="1"
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
