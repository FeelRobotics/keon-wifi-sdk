# WiFi transport flow (Socket.IO)

Once a device is set up it talks to the FeelExchangeCenter (FEC) over a
persistent **Socket.IO** connection. `WifiManager` is the transport for this
channel; it implements the common `KeonController` interface plus the
`RemoteController` settings methods, so control code is identical whether you
later switch to the FUG transport.

The defining trait of this transport is that **status is pushed**: the server
emits `device_status` events as devices report, and the SDK forwards the current
status list to your `onStatusChange(statuses: KeonDeviceStatus[])` callback —
no polling needed.

```mermaid
%% WiFi transport connection flow (Socket.IO).
%% WifiManager.connect -> commands emitted, status pushed.
sequenceDiagram
    autonumber
    participant App as Your app
    participant SDK as WifiManager
    participant OAuth as FeelMe OAuth server
    participant FEC as FeelExchangeCenter (Socket.IO)
    participant Dev as Keon device

    Note over App,FEC: 1 - Connect: WifiManager.connect(feelAppsToken, registrationToken, callbacks)
    App->>SDK: WifiManager.connect(...)
    SDK->>SDK: decode registrationToken JWT<br/>(oauth_server_url, wss_cc_server_url, socket_ns, deviceConnectionKey)
    SDK->>OAuth: POST /api/token/partner/access (Bearer feelAppsToken, deviceConnectionKey)
    OAuth-->>SDK: access token
    SDK->>FEC: io(wss URL + namespace)<br/>auth: Bearer access token, transports: [websocket]
    FEC-->>SDK: connect
    SDK-->>App: WifiManager (RemoteController)

    Note over App,Dev: 2 - Control (command vocabulary shared with FUG)
    App->>SDK: moveTo(speed, position)
    SDK->>FEC: emit send_command_to_devices { command_type: MOVEMENT, arguments }
    FEC->>Dev: relay command

    Note over Dev,App: 3 - Status is pushed by the server
    Dev-->>FEC: status update
    FEC-->>SDK: device_status { payload: { KEON|KEON2 } }
    SDK-->>App: onStatusChange(statuses: KeonDeviceStatus[])
    Dev-->>FEC: physical user activity
    FEC-->>SDK: user_activity_on_device
    SDK-->>App: onUserAction(message)

    Note over App,FEC: 4 - Disconnect
    App->>SDK: disconnect()
    SDK->>FEC: socket disconnect
```

## What each phase does

1. **Connect** — `WifiManager.connect(feelAppsToken, registrationToken, …)`
   decodes the registration token to find the WebSocket server URL, namespace
   and `deviceConnectionKey`, exchanges the partner token for an access token,
   then opens the Socket.IO connection (WebSocket transport only, `Bearer`
   auth). Throws `AuthError` if credentials cannot be obtained.
2. **Control** — `moveTo`, `movementBetween`, `stop`, plus the
   `RemoteController` settings (`setIntensity`, `setStatusInterval`,
   `switchToBtMode`, `resetCredentials`, `forceStatusReport`) are emitted as
   JSON `send_command_to_devices` / `send_settings_to_device` /
   `send_reprovision_command_to_device` events. The exact same command
   vocabulary is reused by the FUG transport.
3. **Status (push)** — the server forwards `device_status`
   (`payload.KEON` / `payload.KEON2`) as they happen. The SDK merges each device
   report into the current status list and calls
   `onStatusChange(statuses: KeonDeviceStatus[])`. `getStatus()` returns the
   primary (first reported) device, and `getStatuses()` returns the full list.
4. **Disconnect** — `disconnect()` closes the socket.
