const NANO = "23456789abcdefghijkmnpqrstuvwxyz";
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** URL-safe slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "")
    .slice(0, 48);
}

/** Short random token for share links / references (no ambiguous chars). */
export function randomToken(length = 10): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += NANO[bytes[i]! % NANO.length];
  return out;
}

/** Human-friendly payment reference, e.g. "FC-7QK2M9PA". */
export function paymentReference(): string {
  return `FC-${randomToken(8).toUpperCase()}`;
}
