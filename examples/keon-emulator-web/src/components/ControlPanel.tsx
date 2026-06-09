import { useAppStore } from '@/store/appStore';
import { ConnectionKeyInput } from './ConnectionKeyInput';
import { ProvisioningBlock } from './ProvisioningBlock';
import { StatusReadouts } from './StatusReadouts';

interface ControlPanelProps {
  onSendStatus: () => void;
}

/**
 * Right panel — device key, provisioning, status send, and live read-outs.
 */
export function ControlPanel({ onSendStatus }: ControlPanelProps) {
  const battery = useAppStore((s) => s.battery);
  const setBattery = useAppStore((s) => s.setBattery);
  const socketStatus = useAppStore((s) => s.socketStatus);
  const accessToken = useAppStore((s) => s.accessToken);

  const canSend = socketStatus === 'connected';

  return (
    <div className="control-panel">
      <h2 className="panel-title">Controls</h2>

      <ConnectionKeyInput />

      <ProvisioningBlock />

      <div className="section-divider" />

      <div className="form-group">
        <label className="form-label" htmlFor="battery-range">
          Battery ({battery}%)
        </label>
        <input
          id="battery-range"
          type="range"
          min={0}
          max={100}
          value={battery}
          onChange={(e) => setBattery(Number(e.target.value))}
          className="range-input"
          aria-label="Battery level"
        />
      </div>

      <button
        className="btn btn-primary btn-wide"
        onClick={onSendStatus}
        disabled={!canSend}
        title={
          canSend
            ? 'Emit current device status over Socket.IO (fsu event)'
            : 'Connect first by provisioning'
        }
      >
        Send Device Status
      </button>

      {!accessToken && (
        <p className="form-hint">Provision above to enable Socket.IO connection.</p>
      )}

      <div className="section-divider" />

      <StatusReadouts />
    </div>
  );
}
