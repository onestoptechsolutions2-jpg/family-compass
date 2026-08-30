const DEFAULT_CC = "254"; // Kenya

/**
 * Normalise a user-typed phone into bare international digits (no +, no spaces).
 * "0712 345678" -> "254712345678", "+254712345678" -> "254712345678".
 */
export function normalizePhone(input: string, countryCode = DEFAULT_CC): string {
  let d = (input || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = countryCode + d.slice(1);
  else if (d.length <= 10 && !d.startsWith(countryCode)) d = countryCode + d;
  return d;
}

export function isValidPhone(input: string): boolean {
  const d = normalizePhone(input);
  return d.length >= 10 && d.length <= 15;
}

/** Pretty "+254 712 345 678" for display. */
export function displayPhone(digits: string): string {
  const d = normalizePhone(digits);
  if (!d) return "";
  return "+" + d.replace(/^(\d{1,3})(\d{3})(\d{3})(\d+)$/, "$1 $2 $3 $4");
}

/** wa.me click-to-chat link that opens the sender's own WhatsApp. */
export function waLink(phone: string, text: string): string {
  const to = normalizePhone(phone);
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** Short human-readable claim code, e.g. "DINDI-4821". */
export function claimCode(surname?: string | null): string {
  const base =
    (surname || "FAM")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6) || "FAM";
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `${base}-${n}`;
}
