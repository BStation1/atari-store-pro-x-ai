/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes Egyptian phone numbers to international format (e.g. 01012345678 -> 201012345678)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  // Remove spaces, dashes, or non-numeric characters
  let clean = phone.replace(/[^0-9]/g, "");
  
  // If starts with 002, convert to 2
  if (clean.startsWith("002")) {
    clean = clean.substring(2);
  }
  
  // If starts with +20, it is 20 (plus was removed already)
  
  // Standard Egyptian mobile number checks
  if (clean.startsWith("01") && clean.length === 11) {
    clean = "2" + clean;
  } else if (clean.startsWith("1") && clean.length === 10) {
    // If entered without leading 0 (e.g., 10xxxxxxxx)
    clean = "20" + clean;
  }
  
  return clean;
}

/**
 * Validates whether a phone number matches standard Egyptian mobile formats
 */
export function validatePhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Egyptian numbers in international format start with 2010, 2011, 2012, 2015 and have exactly 12 digits
  const egRegex = /^201[0125]\d{8}$/;
  return egRegex.test(normalized);
}

/**
 * Formats phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const clean = phone.trim();
  const normalized = normalizePhoneNumber(clean);
  if (normalized.startsWith("201") && normalized.length === 12) {
    return `0${normalized.substring(2)}`;
  }
  return clean;
}
