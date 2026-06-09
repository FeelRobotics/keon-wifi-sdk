import { FugManager, KeonError } from "@feelrobotics/keon-wifi-sdk";

// FUG is the only transport that works fully headless: no browser, no Web
// Bluetooth, no OAuth — just a deviceConnectionKey (DCK) and HTTP. This is the
// clearest demonstration of controlling an already-provisioned device from a
// server, a CI job, or any Node backend.
//
// Get a deviceConnectionKey by provisioning the device first (the FeelConnect
// app, or a classic browser example), then pass it here.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Set the ${name} environment variable.`);
    process.exit(1);
  }
  return value;
}

const deviceConnectionKey = requireEnv("KEON_DEVICE_CONNECTION_KEY");

async function main() {
  // connect just opens the transport and starts the 2-second status poll.
  const keon = await FugManager.connect({
    deviceConnectionKey,
    statusPollIntervalSec: 2,
    // One connection key can cover several devices, so status is a list.
    onStatusChange: (statuses) =>
      console.log("status:", JSON.stringify(statuses)),
  });

  // The SDK doesn't fetch on connect; pull the initial status ourselves.
  await keon.forceStatusReport();

  console.log("Connected over FUG. Sending commands...");
  await keon.moveTo(50, 90);
  await keon.movementBetween(60, 0, 100);
  await keon.setIntensity(50); // intensity is a percentage (0..100)

  // Let polled status stream in for 10 seconds, then stop and disconnect.
  await new Promise((resolve) => setTimeout(resolve, 10_000));

  await keon.stop();
  await keon.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  if (error instanceof KeonError) {
    console.error(`Keon SDK error: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
