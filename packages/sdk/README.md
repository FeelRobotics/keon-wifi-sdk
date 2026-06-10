# Keon WiFi SDK (React)

## Overview

The **Keon WiFi SDK** is a TypeScript library designed for integration with React applications, facilitating seamless provisioning and management of Keon WiFi devices via Bluetooth Low Energy (BLE). The SDK simplifies interactions with Keon WiFi and enabling developers to quickly incorporate connectivity features into their React projects.

---

## Features

- **Server Communication**: Easily select optimal servers and obtain registration tokens required for provisioning.
- **Bluetooth Connectivity**: Integrated BLE support to connect directly to Keon WiFi hardware.
- **WiFi Provisioning**: Securely provision WiFi credentials to connected devices.
- **Easy Integration**: Designed specifically for React applications, enabling straightforward integration and usage.

---

## Installation

```sh
npm install @feelrobotics/keon-wifi-sdk-react
# or
yarn add @feelrobotics/keon-wifi-sdk-react
```

---

## Usage

### Basic Example

```typescript
import {
  getTokenForKeonWiFi,
  provisioningKeonWiFi,
  keonWiFiManager,
  KeonManager
} from '@feelrobotics/keon-wifi-sdk-react';

// Step 1: Setup a Keon WiFi device with network credentials
async function setupKeonDevice(feelAppsToken: string, ssid: string, password: string) {
  try {
    // Get registration token and device connection key from server
    // getTokenForKeonWiFi accepts feelAppsToken and optional deviceConnectionKey
    const [registrationToken, deviceConnectionKey] = await getTokenForKeonWiFi(feelAppsToken);

    if (!registrationToken) {
      console.error('Failed to obtain registration token.');
      return null;
    }

    console.log('Registration successful with token:', registrationToken);

    // Connect to the device via BLE and provision WiFi credentials
    // provisioningKeonWiFi handles BLE connection, provisioning, and disconnection automatically
    const [keonDevice, deviceData] = await provisioningKeonWiFi(registrationToken, ssid, password);
    console.log('Provisioning completed:', keonDevice);
    console.log('Device data:', deviceData);

    return { registrationToken, deviceConnectionKey };
  } catch (error) {
    console.error('Setup Error:', error);
    return null;
  }
}

// Step 2: Create a connection manager to handle ongoing device communication
async function connectToKeonDevice(feelAppsToken: string, registrationToken: string) {
  if (!feelAppsToken || !registrationToken) {
    console.error("Please login to the server first!");
    return null;
  }

  // Create a KeonManager instance for ongoing communication
  // keonWiFiManager requires feelAppsToken, registrationToken, and a userActionHandler callback
  const manager = await keonWiFiManager(
    feelAppsToken,
    registrationToken,
    (message: any) => {
      // Handle messages from the device
      console.log('Device message:', message);
    }
  );

  if (manager) {
    try {
      // Initialize the connection
      await manager.init();
      console.log('Keon WiFi manager connected');
      
      // Get current device status
      const deviceStatus = manager.getDeviceStatus();
      console.log('Device status:', deviceStatus);
      
      // You can set up polling for status updates
      const intervalId = setInterval(() => {
        const status = manager.getDeviceStatus();
        console.log('Updated status:', status);
      }, 2000); // Update every 2 seconds
      
      return { manager, intervalId };
    } catch (error) {
      console.error('Connection Error:', error);
      return null;
    }
  }
  
  return null;
}

// Example usage
async function main() {
  const feelAppsToken = 'your_feel_apps_token'; // https://developer.feeltechnology.com/docs/controlplane/markdowns/API#get-partner-token
  const wifiSSID = 'your_wifi_ssid';
  const wifiPassword = 'your_wifi_password';

  // First provision the device
  const setupResult = await setupKeonDevice(feelAppsToken, wifiSSID, wifiPassword);
  
  if (setupResult) {
    // Then create an ongoing connection manager
    const connection = await connectToKeonDevice(feelAppsToken, setupResult.registrationToken);
    
    // You can now use the manager to interact with the device
    if (connection && connection.manager) {
      // Work with the device
      console.log('Connected to device!');
      
      // Clean up when done
      clearInterval(connection.intervalId);
      
      // Disconnect from server
      try {
        await connection.manager.close();
        console.log('Disconnected from server');
      } catch (err) {
        console.error("Disconnection Error:", err);
      }
    }
  }
}
```

### CLI Example

```sh
yarn token -- <feelAppsToken>
```

---

## Project Structure

```
@feelrobotics/keon-wifi-sdk-react
├── src
│   ├── api              # API integration layer
│   ├── ble              # Bluetooth-related functionality
│   ├── socketio         # Socket.IO communication
│   ├── utils            # General utility functions
│   └── index.ts         # Main entry point
└── test                 # Test suite
```


## Compatibility

- **Node.js**: >= v10
- **React**: >= v16

---

## Documentation

[Step-by-step integration instructions can be found in the online documentation.](https://developer.feeltechnology.com/docs/keon_wifi/keonwifi_sdk.html)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Author

OleksiyB

