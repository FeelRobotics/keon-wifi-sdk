/** Shared argument validation for device commands. */

export function assertIntegerInRange(
  name: string,
  value: number,
  min: number,
  max: number
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(
      `${name} must be an integer between ${min} and ${max}`
    );
  }
}

/** Movement speed/position values are integers in 0..100. */
export const assertMovementValue = (name: string, value: number): void =>
  assertIntegerInRange(name, value, 0, 100);

/** Intensity is a percentage: an integer in 0..100. */
export const assertSettingsValue = (name: string, value: number): void =>
  assertIntegerInRange(name, value, 0, 100);

/** Status interval values are integers in 0..1000. */
export const assertStatusIntervalValue = (name: string, value: number): void =>
  assertIntegerInRange(name, value, 0, 1000);
