/**
 * Utility for normalizing phone numbers for comparison across Egyptian formats:
 * - Removes non-digits
 * - Handles country prefix +20 / 20
 * - Handles leading 0 (e.g. 01278316303 -> 1278316303)
 */
export function normalizePhoneForComparison(phone?: string | null): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  
  // Handle Egyptian country code +20 (e.g. 201278316303 -> 1278316303)
  if (digits.startsWith("20") && digits.length === 12) {
    digits = digits.slice(2);
  }
  
  // Handle local Egyptian 01x prefix (e.g. 01278316303 -> 1278316303)
  if (digits.startsWith("01") && digits.length === 11) {
    digits = digits.slice(1);
  }

  return digits;
}

export function isPhoneMatch(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const nA = normalizePhoneForComparison(phoneA);
  const nB = normalizePhoneForComparison(phoneB);
  if (!nA || !nB) return false;
  if (nA === nB) return true;
  
  if (nA.length >= 8 && nB.length >= 8) {
    return nA.includes(nB) || nB.includes(nA);
  }
  
  return false;
}
