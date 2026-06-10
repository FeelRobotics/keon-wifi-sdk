import React, { useState } from "react";
import { KeonManager } from "@feelrobotics/keon-wifi-sdk-react/dist/socketio/keonManager";
import "../App.css";

// Import the newly created components
import ConnectionPanel from "./ConnectionPanel";
import MovementPanel from "./MovementPanel";
import DeviceSettingsPanel from "./DeviceSettingsPanel";

const CustomerPanel = (props: any) => {
  const { feelAppsToken, registrationToken, onDisconnect } = props;

  // State is now managed at the parent level and passed to child components
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [keonManager, setKeonManager] = useState<KeonManager | null>(null);

  return (
    <div className="panel-container">
      <ConnectionPanel
        feelAppsToken={feelAppsToken}
        registrationToken={registrationToken}
        isConnected={isConnected}
        setIsConnected={setIsConnected}
        onDisconnect={onDisconnect}
        keonManager={keonManager}
        setKeonManager={setKeonManager}
      />

      <MovementPanel keonManager={keonManager} isConnected={isConnected} />

      <DeviceSettingsPanel
        keonManager={keonManager}
        isConnected={isConnected}
      />
    </div>
  );
};

export { CustomerPanel };
