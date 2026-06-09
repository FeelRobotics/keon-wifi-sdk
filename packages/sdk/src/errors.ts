/**
 * Base class for all errors thrown by the Keon WiFi SDK.
 * Use `instanceof KeonError` to catch any SDK-originated failure.
 */
export class KeonError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KeonError';
  }
}

/** Thrown when authentication or token retrieval fails. */
export class AuthError extends KeonError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AuthError';
  }
}

/** Thrown when Bluetooth device selection or connection fails. */
export class KeonBLEError extends KeonError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KeonBLEError';
  }
}

/** Thrown when the WiFi provisioning handshake fails. */
export class KeonProvisioningError extends KeonError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KeonProvisioningError';
  }
}
