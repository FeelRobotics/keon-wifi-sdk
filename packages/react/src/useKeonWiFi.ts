import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BleManager,
  WifiManager,
  FugManager,
} from '@feelrobotics/keon-wifi-sdk';
import type {
  KeonController,
  KeonDeviceStatus,
  KeonBlePosition,
} from '@feelrobotics/keon-wifi-sdk';

/** Options for connecting the FUG transport from the hook. */
export interface ConnectFugOptions {
  deviceConnectionKey: string;
  /** Status poll interval in seconds (defaults to 30 in the SDK; 0 disables). */
  statusPollIntervalSec?: number;
}

export interface UseKeonWiFi {
  /** The active controller for any transport, or null. */
  controller: KeonController | null;
  /** Latest status of the primary device (WiFi/FUG transports), or null. */
  status: KeonDeviceStatus | null;
  /** Latest status of every device on the connection (WiFi/FUG transports). */
  statuses: KeonDeviceStatus[];
  /** Latest motor position (BLE transport), or null. */
  position: KeonBlePosition | null;
  /** Connect over BLE for direct control (browser-only). */
  connectBle: () => Promise<BleManager>;
  /** Connect the WiFi (Socket.IO) manager to an already-configured device. */
  connectWifi: (registrationToken: string) => Promise<WifiManager>;
  /** Connect the FUG (REST) manager to an already-configured device. */
  connectFug: (options: ConnectFugOptions) => Promise<FugManager>;
  /** Close the active connection and reset state. */
  disconnect: () => void;
}

/**
 * React hook around the Keon WiFi SDK. Manages the active controller across all
 * transports (BLE, WiFi, FUG) and closes the connection automatically on unmount.
 *
 * @param feelAppsToken Partner access token issued by FeelRobotics.
 */
export function useKeonWiFi(feelAppsToken: string): UseKeonWiFi {
  const [controller, setController] = useState<KeonController | null>(null);
  const [statuses, setStatuses] = useState<KeonDeviceStatus[]>([]);
  const [position, setPosition] = useState<KeonBlePosition | null>(null);
  const status = statuses[0] ?? null;
  const controllerRef = useRef<KeonController | null>(null);
  const mountedRef = useRef(true);

  const adopt = useCallback(<T extends KeonController>(next: T): T => {
    if (!mountedRef.current) {
      // The hook unmounted while connecting — close the late connection
      // instead of adopting it, so nothing keeps running unobserved.
      void next.disconnect();
      return next;
    }
    const prev = controllerRef.current;
    if (prev && prev !== next) {
      void prev.disconnect();
    }
    controllerRef.current = next;
    setController(next);
    return next;
  }, []);

  const connectBle = useCallback(async () => {
    const manager = await BleManager.connect({ onPosition: setPosition });
    return adopt(manager);
  }, [adopt]);

  const connectWifi = useCallback(
    async (registrationToken: string) => {
      const manager = await WifiManager.connect(
        feelAppsToken,
        registrationToken,
        { onStatusChange: setStatuses }
      );
      return adopt(manager);
    },
    [feelAppsToken, adopt]
  );

  const connectFug = useCallback(
    async (options: ConnectFugOptions) => {
      const manager = await FugManager.connect({
        ...options,
        onStatusChange: setStatuses,
      });
      return adopt(manager);
    },
    [adopt]
  );

  const disconnect = useCallback(() => {
    void controllerRef.current?.disconnect();
    controllerRef.current = null;
    setController(null);
    setStatuses([]);
    setPosition(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void controllerRef.current?.disconnect();
    };
  }, []);

  return {
    controller,
    status,
    statuses,
    position,
    connectBle,
    connectWifi,
    connectFug,
    disconnect,
  };
}
