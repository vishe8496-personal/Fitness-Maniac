// Normalize mobile numbers to a consistent E.164-ish string for storage & lookup.

/**
 * Normalize a user-entered mobile number.
 * - strips spaces, dashes, parens
 * - keeps a leading '+'
 * - if no country code and a bare local number is given, prepends DEFAULT_COUNTRY_CODE
 * Returns null if it clearly isn't a phone number.
 */
export function normalizeMobile(input: string): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[\s()\-.]/g, '');

  const hasPlus = s.startsWith('+');
  s = s.replace(/^\+/, '').replace(/^0+/, ''); // drop leading + and trunk zeros

  if (!/^\d{6,15}$/.test(s)) return null;

  const cc = (process.env.DEFAULT_COUNTRY_CODE || '').replace(/\D/g, '');
  // If the number looks like a bare local number (<= 10 digits) and didn't
  // include a '+', prepend the default country code.
  if (!hasPlus && cc && s.length <= 10) {
    s = cc + s;
  }
  return '+' + s;
}
