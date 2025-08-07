/**
 * Function to convert a 16-bit UUID to a full UUID string format
 * according to the Bluetooth standard (using the Bluetooth namespace).
 *
 * UUID consists of 128 bits (16 bytes), divided into 5 parts:
 * xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * Where:
 * - 0000-1000-8000-00805f9b34fb — this is the fixed part for the Bluetooth namespace
 * - The remaining part (e.g., 2a19) — is the unique identifier for a characteristic or service.
 *
 * @param {number} shortUUID - A 16-bit UUID value (e.g., 0x2a19)
 * @returns {string} Full UUID in string format for Bluetooth
 */
export function toFullUUID(shortUUID: number | BluetoothCharacteristicUUID): string {
  // Convert the number to a hex string (with leading zeros)
  const hexStr = shortUUID.toString(16).padStart(4, '0');

  // Form the full UUID by adding the standard Bluetooth namespace
  return `0000${hexStr}-0000-1000-8000-00805f9b34fb`;
}

/**
 * Function to extract the 16-bit value from a full Bluetooth UUID string.
 *
 * A UUID consists of 128 bits, with the first 16 bits (e.g., 2a19) representing the characteristic ID.
 * The rest of the UUID (0000-1000-8000-00805f9b34fb) is the Bluetooth standard.
 * We extract only the first part of the UUID string.
 *
 * @param {string} fullUUID - A full UUID string in Bluetooth format
 * @returns {number} The 16-bit UUID value
 */
export function fromFullUUID(fullUUID: string): number {
  // Extract the 16-bit value from the first part of the UUID (after the first 4 characters and dash)
  const hexStr = fullUUID.substring(4, 8); // Take part 00002a19
  return parseInt(hexStr, 16); // Convert to number
}
