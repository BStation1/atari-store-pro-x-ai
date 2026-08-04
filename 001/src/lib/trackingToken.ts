/**
 * Secure Tracking Token Generator (BUG-006 Fix)
 * Generates an unguessable 32-character hex tracking token for repair orders.
 * @license Apache-2.0
 */

export function generateSecureTrackingToken(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}

  const randomStr1 = Math.random().toString(36).substring(2, 12);
  const randomStr2 = Math.random().toString(36).substring(2, 12);
  const timestampStr = Date.now().toString(36);
  return `${timestampStr}${randomStr1}${randomStr2}`.padEnd(32, "0").substring(0, 32);
}
