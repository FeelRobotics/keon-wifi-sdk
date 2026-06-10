import React, { useState } from "react";
import { KeonManager } from "@feelrobotics/keon-wifi-sdk-react/dist/socketio/keonManager";

interface MovementPanelProps {
  keonManager: KeonManager | null;
  isConnected: boolean;
}

const MovementPanel: React.FC<MovementPanelProps> = ({
  keonManager,
  isConnected,
}) => {
  // Movement parameters
  const [moveToSpeed, setMoveToSpeed] = useState<number>(100);
  const [moveToPosition, setMoveToPosition] = useState<number>(50);
  const [movementBetweenSpeed, setMovementBetweenSpeed] = useState<number>(100);
  const [movementBetweenMin, setMovementBetweenMin] = useState<number>(0);
  const [movementBetweenMax, setMovementBetweenMax] = useState<number>(100);

  async function send_movement_command_to_devices() {
    if (!keonManager) {
      console.error("Please login to the server first!");
      return;
    }

    // Use the state variables for speed and position
    keonManager.moveTo(moveToSpeed, moveToPosition);
  }

  async function send_movement_between_command_to_devices() {
    if (!keonManager) {
      console.error("Please login to the server first!");
      return;
    }

    // Use the state variables for speed, min, and max position
    await keonManager.movementBetween(
      movementBetweenSpeed,
      movementBetweenMin,
      movementBetweenMax
    );
  }

  async function send_stop_command_to_devices() {
    if (!keonManager) {
      console.error("Please login to the server first!");
      return;
    }

    await keonManager.stopCommand();
  }

  return (
    <div className="control-section">
      <h3>Movement Controls</h3>

      <div className="setting-group">
        <label className="input-label">Move To</label>
        <div className="movement-controls">
          <div className="input-with-label">
            <span>Speed:</span>
            <input
              type="number"
              value={moveToSpeed}
              onChange={(e) => setMoveToSpeed(Number(e.target.value))}
              min="0"
              max="100"
              step="1"
            />
          </div>
          <div className="input-with-label">
            <span>Position:</span>
            <input
              type="number"
              value={moveToPosition}
              onChange={(e) => setMoveToPosition(Number(e.target.value))}
              min="0"
              max="100"
              step="1"
            />
          </div>
          <button
            onClick={send_movement_command_to_devices}
            disabled={!isConnected}
          >
            Move To
          </button>
        </div>
      </div>

      <div className="setting-group">
        <label className="input-label">Movement Between</label>
        <div className="movement-controls">
          <div className="input-with-label">
            <span>Speed:</span>
            <input
              type="number"
              value={movementBetweenSpeed}
              onChange={(e) => setMovementBetweenSpeed(Number(e.target.value))}
              min="0"
              max="100"
              step="1"
            />
          </div>
          <div className="input-with-label">
            <span>Min:</span>
            <input
              type="number"
              value={movementBetweenMin}
              onChange={(e) => setMovementBetweenMin(Number(e.target.value))}
              min="0"
              max="100"
              step="1"
            />
          </div>
          <div className="input-with-label">
            <span>Max:</span>
            <input
              type="number"
              value={movementBetweenMax}
              onChange={(e) => setMovementBetweenMax(Number(e.target.value))}
              min="0"
              max="100"
              step="1"
            />
          </div>
          <button
            onClick={send_movement_between_command_to_devices}
            disabled={!isConnected}
          >
            Move Between
          </button>
        </div>
      </div>

      <div className="button-row">
        <button
          onClick={send_stop_command_to_devices}
          disabled={!isConnected}
          className="stop-button"
        >
          Stop All Movement
        </button>
      </div>
    </div>
  );
};

export default MovementPanel;
