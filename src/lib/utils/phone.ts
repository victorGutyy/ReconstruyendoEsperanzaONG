// Colombian phone numbers (settings, contact form). Pure.

/**
 * A Colombian mobile or landline as +57 and ten digits. Accepts what people
 * type: spaces, dashes, parentheses, with or without +57. Null if it is not one.
 */
export function normalizeColombianPhone(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, "");
  const match = /^(?:\+?57)?([0-9]{10})$/.exec(digits);
  return match ? `+57${match[1]}` : null;
}

/** "+573001112233" → "300 111 2233", as people read it. */
export function formatColombianPhone(e164: string): string {
  const local = e164.replace(/^\+57/, "");
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
