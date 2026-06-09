import React from "react";
import type {
  UseKeonWiFi,
  RemoteController,
} from "@feelrobotics/keon-wifi-sdk-react";
import "../App.css";

// Import the newly created components
import ConnectionPanel from "./ConnectionPanel";
import MovementPanel from "./MovementPanel";
import DeviceSettingsPanel from "./DeviceSettingsPanel";

interface CustomerPanelProps {
  keon: UseKeonWiFi;
  registrationToken: string | null;
  onDisconnect: () => void;
}

const CustomerPanel: React.FC<CustomerPanelProps> = ({
  keon,
  registrationToken,
  onDisconnect,
}) => {
  // Connection state is derived from the hook — the controller is non-null once connected.
  const controller = keon.controller;
  const isConnected = controller !== null;
  // Device settings are only available on the server-backed (remote) transports.
  const remote =
    controller && controller.transport !== "ble"
      ? (controller as RemoteController)
      : null;

  return (
    <div className="panel-container">
      <ConnectionPanel
        keon={keon}
        registrationToken={registrationToken}
        onDisconnect={onDisconnect}
      />

      <MovementPanel controller={controller} isConnected={isConnected} />

      <DeviceSettingsPanel controller={remote} isConnected={remote !== null} />
    </div>
  );
};

export { CustomerPanel };
