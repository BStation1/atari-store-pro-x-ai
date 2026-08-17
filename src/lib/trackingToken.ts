/**
 * Secure Tracking Token Generator (BUG-006 Fix)
 * Generates an unguessable 32-character hex tracking token for repair orders.
 * @license Apache-2.0
 */

export function generateSecureTrackingToken(): string {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Secure random number generation is unavailable; tracking token was not created.");
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
