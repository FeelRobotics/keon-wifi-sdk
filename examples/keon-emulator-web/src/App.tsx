import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { KeonSocketTransport } from '@/lib/socket';
import { parseDeviceCommand, parseDeviceSetup, parseDeviceReprovision } from '@/lib/position';
import type { DeviceCommandRaw, DeviceSetupRaw, DeviceReprovisionRaw } from '@/types/schema';
import { VesselView } from '@/components/VesselView';
import { ControlPanel } from '@/components/ControlPanel';
import { LogConsole } from '@/components/LogConsole';
import { appConfig } from '@/config/appConfig';

export function App() {
  const accessToken = useAppStore((s) => s.accessToken);
  const refreshToken = useAppStore((s) => s.refreshToken);
  const setSocketStatus = useAppStore((s) => s.setSocketStatus);
  const updateAccessToken = useAppStore((s) => s.updateAccessToken);
  const applyMovementCommand = useAppStore((s) => s.applyMovementCommand);
  const applyMovementBetweenCommand = useAppStore((s) => s.applyMovementBetweenCommand);
  const applyPauseCommand = useAppStore((s) => s.applyPauseCommand);
  const applySpeedIntensity = useAppStore((s) => s.applySpeedIntensity);
  const applyRangeIntensity = useAppStore((s) => s.applyRangeIntensity);
  const addLog = useAppStore((s) => s.addLog);
  const buildFsuPayload = useAppStore((s) => s.buildFsuPayload);

  const transportRef = useRef<KeonSocketTransport | null>(null);

  const [footerHeight, setFooterHeight] = useState(280);
  const footerRef = useRef<HTMLElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  const handleResizeStart = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = footerRef.current?.offsetHeight ?? footerHeight;
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartYRef.current - e.clientY;
      const next = Math.max(80, Math.min(window.innerHeight * 0.7, dragStartHeightRef.current + delta));
      setFooterHeight(next);
    };
    const onMouseUp = () => { isDraggingRef.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const sendStatus = () => {
    const payload = buildFsuPayload();
    transportRef.current?.sendStatus(payload);
    addLog('out', 'fsu:manual', payload);
  };

  useEffect(() => {
    if (!accessToken || !refreshToken) return;

    setSocketStatus('connecting');

    const transport = new KeonSocketTransport({
      wsUrl: appConfig.fecServerUrl,
      accessToken,
      refreshToken,
      oauthBaseUrl: appConfig.oauthServerUrl,
      handlers: {
        onConnect() {
          setSocketStatus('connected');
          // Emit initial device status upon successful handshake.
          const payload = useAppStore.getState().buildFsuPayload();
          transport.sendStatus(payload);
        },
        onDisconnect(reason) {
          setSocketStatus('disconnected');
          addLog('system', 'socket:disconnect', { reason });
        },
        onError(error) {
          setSocketStatus('error');
          addLog('error', 'socket:error', { message: error.message });
        },
        onCommandForDevice(data: DeviceCommandRaw) {
          const parsed = parseDeviceCommand(data);
          switch (parsed.type) {
            case 'MOVEMENT':
              applyMovementCommand(parsed.speed, parsed.position);
              break;
            case 'MOVEMENT_BETWEEN':
              applyMovementBetweenCommand(parsed.speed, parsed.minPosition, parsed.maxPosition);
              break;
            case 'PAUSE':
              applyPauseCommand();
              break;
          }
        },
        onChangeDeviceSettings(data: DeviceSetupRaw) {
          const parsed = parseDeviceSetup(data);
          switch (parsed.type) {
            case 'SPEED_INTENSITY_ADJUSTMENT':
              applySpeedIntensity(parsed.intensity);
              break;
            case 'RANGE_INTENSITY_ADJUSTMENT':
              applyRangeIntensity(parsed.intensity);
              break;
          }
        },
        onChangeDeviceMode(data: DeviceReprovisionRaw) {
          const parsed = parseDeviceReprovision(data);
          addLog('in', 'reprovision', { type: parsed.type });
        },
        onRequestDeviceStatus() {
          const payload = useAppStore.getState().buildFsuPayload();
          transport.sendStatus(payload);
        },
        onLog(direction, event, data) {
          addLog(direction, event, data);
        },
        onTokenRefreshed(newToken) {
          updateAccessToken(newToken);
        },
      },
    });

    transportRef.current = transport;
    transport.connect();

    return () => {
      transport.dispose();
      transportRef.current = null;
      setSocketStatus('disconnected');
    };
    // Re-create transport only when accessToken changes (e.g., after refresh).
  }, [accessToken]);

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Keon Device Emulator</h1>
        <span className="app-subtitle">Partner Integration Tool</span>
      </header>

      <main className="app-main">
        <section className="panel panel-vessel" aria-label="Device Visualization">
          <VesselView />
        </section>

        <section className="panel panel-controls" aria-label="Device Controls">
          <ControlPanel onSendStatus={sendStatus} />
        </section>
      </main>

      <footer ref={footerRef} className="app-footer" style={{ height: footerHeight }} aria-label="Event Log">
        <div className="log-resize-handle" onMouseDown={handleResizeStart} />
        <LogConsole />
      </footer>
    </div>
  );
}
