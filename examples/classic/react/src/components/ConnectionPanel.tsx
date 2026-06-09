import React from "react";
import type { UseKeonWiFi } from "@feelrobotics/keon-wifi-sdk-react";

interface ConnectionPanelProps {
  keon: UseKeonWiFi;
  registrationToken: string | null;
  onDisconnect: () => void;
}

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  keon,
  registrationToken,
  onDisconnect,
}) => {
  // The hook owns the controller lifecycle; status is pushed live via onStatusChange.
  const isConnected = keon.controller !== null;

  async function handlerConnectToFecServer() {
    if (!registrationToken) {
      console.error("Please login to the server first!");
      return;
    }

    try {
      // keon.connectWifi() opens the Socket.IO manager and stores the controller.
      await keon.connectWifi(registrationToken);
    } catch (err) {
      console.error("Connection Error:", err);
    }
  }

  function handlerDisconnectFromFecServer() {
    keon.disconnect();
    onDisconnect();
  }

  return (
    <div className="connection-section">
      <h3>Connection</h3>
      <div className="button-row">
        <button
          className={isConnected ? "connected" : ""}
          onClick={handlerConnectToFecServer}
          disabled={!registrationToken}
        >
          {isConnected ? "Connected" : "Connect to Server"}
        </button>

        <button
          onClick={handlerDisconnectFromFecServer}
          className="disconnect-button"
          disabled={!registrationToken}
        >
          Disconnect
        </button>
      </div>

      {isConnected && keon.status && (
        <div className="device-status-container">
          <h4>Device Status</h4>
          <div className="device-status-data">
            <pre>{JSON.stringify(keon.status, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
