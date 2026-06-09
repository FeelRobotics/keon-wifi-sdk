import { useAppStore } from '@/store/appStore';

/**
 * Live read-outs for intensity, stroker_level, position, and socket status.
 * Values update in real time from inbound FEC commands.
 */
export function StatusReadouts() {
  const intensity = useAppStore((s) => s.intensity);
  const strokerLevel = useAppStore((s) => s.strokerLevel);
  const position = useAppStore((s) => s.position);
  const speed = useAppStore((s) => s.speed);
  const socketStatus = useAppStore((s) => s.socketStatus);
  const animationParams = useAppStore((s) => s.animationParams);

  const statusLabel: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting…',
    error: 'Error',
    disconnected: 'Disconnected',
  };

  const statusClass: Record<string, string> = {
    connected: 'status-ok',
    connecting: 'status-warn',
    error: 'status-error',
    disconnected: 'status-neutral',
  };

  return (
    <div className="status-readouts">
      <h3 className="section-title">Live Read-outs</h3>
      <div className="readout-grid">
        <div className="readout-item">
          <span className="readout-label">Intensity</span>
          <span className="readout-value">{Math.round(intensity)}</span>
        </div>
        <div className="readout-item">
          <span className="readout-label">Stroker Level</span>
          <span className="readout-value">{Math.round(strokerLevel)}</span>
        </div>
        <div className="readout-item">
          <span className="readout-label">Position</span>
          <span className="readout-value">{Math.round(position)}%</span>
        </div>
        <div className="readout-item">
          <span className="readout-label">Speed</span>
          <span className="readout-value">{Math.round(speed)}</span>
        </div>
        <div className="readout-item">
          <span className="readout-label">Mode</span>
          <span className="readout-value">
            {animationParams ? 'Stroking' : 'Static'}
          </span>
        </div>
        <div className="readout-item">
          <span className="readout-label">Socket</span>
          <span className={`readout-value ${statusClass[socketStatus] ?? ''}`}>
            {statusLabel[socketStatus] ?? socketStatus}
          </span>
        </div>
      </div>
    </div>
  );
}
