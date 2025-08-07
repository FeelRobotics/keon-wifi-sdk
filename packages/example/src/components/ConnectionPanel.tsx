import React, { useState, useEffect } from "react";
import {
  KeonManager,
  KeonDeviceStatus,
} from "@feelrobotics/keon-wifi-sdk-react/dist/socketio/keonManager";
import { keonWiFiManager } from "@feelrobotics/keon-wifi-sdk-react";

interface ConnectionPanelProps {
  feelAppsToken: string | null;
  registrationToken: string | null;
  isConnected: boolean;
  setIsConnected: (isConnected: boolean) => void;
  onDisconnect: () => void;
  keonManager: KeonManager | null;
  setKeonManager: (manager: KeonManager | null) => void;
}

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  feelAppsToken,
  registrationToken,
  isConnected,
  setIsConnected,
  onDisconnect,
  keonManager,
  setKeonManager,
}) => {
  const [deviceStatus, setDeviceStatus] = useState<KeonDeviceStatus | null>(null);

  // Update device status periodically when connected
  useEffect(() => {
    if (!isConnected || !keonManager) {
      setDeviceStatus(null);
      return;
    }

    // Get initial status
    setDeviceStatus(keonManager.getDeviceStatus());

    // Set up interval to poll for status updates
    const intervalId = setInterval(() => {
      setDeviceStatus(keonManager.getDeviceStatus());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(intervalId);
  }, [isConnected, keonManager]);
  async function handlerConnectToCcWsServer() {
    if (!feelAppsToken || !registrationToken) {
      console.error("Please login to the server first!");
      return;
    }

    const manager = await keonWiFiManager(
      feelAppsToken,
      registrationToken,
      () => { }
    );

    if (manager) {
      try {
        await manager.init();
        setIsConnected(true);
        setKeonManager(manager);
      } catch (err) {
        console.error("Connection Error:", err);
        setIsConnected(false);
        setKeonManager(null);
      }
    }
  }

  async function handlerDisconnectFromCcWsServer() {
    if (keonManager) {
      try {
        await keonManager.close();
      } catch (err) {
        console.error("Disconnection Error:", err);
      }
      setIsConnected(false);
      setKeonManager(null);
    }

    onDisconnect();
  }

  return (
    <div className="connection-section">
      <h3>Connection</h3>
      <div className="button-row">
        <button
          className={isConnected ? "connected" : ""}
          onClick={handlerConnectToCcWsServer}
          disabled={!registrationToken}
        >
          {isConnected ? "Connected" : "Connect to Server"}
        </button>

        <button
          onClick={handlerDisconnectFromCcWsServer}
          className="disconnect-button"
          disabled={!registrationToken}
        >
          Disconnect
        </button>
      </div>

      {isConnected && deviceStatus && (
        <div className="device-status-container">
          <h4>Device Status</h4>
          <div className="device-status-data">
            <pre>{JSON.stringify(deviceStatus, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
