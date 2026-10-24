// Pure referral rules: no database, so they are unit-tested and safe anywhere.

/** The cookie a /r/<code> link leaves, so a customer who browses first is still credited. */
export const REF_COOKIE = "fc_ref";
/** How long a link keeps crediting its referrer. */
export const REF_COOKIE_DAYS = 30;

export const REFERRER_KINDS = [
  ["funeral_home", "Funeral home or mortuary"],
  ["church", "Church or mosque"],
  ["individual", "Individual"],
  ["other", "Other organisation"],
  ["chama", "Chama group"],
] as const;
export type ReferrerKind = (typeof REFERRER_KINDS)[number][0];
export const isReferrerKind = (v: string): v is ReferrerKind => REFERRER_KINDS.some(([k]) => k === v);

/** A code as people type it: "grace-24 " → "GRACE24". Null if it cannot be a code. */
export function normaliseCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length >= 4 && c.length <= 16 ? c : null;
}

/** A code made from a name: the first letters, then digits, e.g. "Grace Akinyi" → "GRACEA" + "472". */
export function codeStem(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  return letters.length >= 2 ? letters : "FAMILY";
}

/** What a referrer earns: a whole number of shillings, rounded down, never negative. */
export function commissionKes(paidKes: number, percent: number): number {
  if (!Number.isFinite(paidKes) || !Number.isFinite(percent) || paidKes <= 0 || percent <= 0) return 0;
  return Math.floor((paidKes * Math.min(percent, 100)) / 100);
}

/** A Kenyan mobile number in one form, 2547XXXXXXXX or 2541XXXXXXXX. Null if it is not one. */
export function normalisePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("254") ? d.slice(3) : d.startsWith("0") ? d.slice(1) : d;
  return /^[17]\d{8}$/.test(local) ? `254${local}` : null;
}

/**
 * Which referrer an order is credited to: a code the customer typed wins over one a link
 * left behind. Nobody earns on their own order, and a suspended referrer earns nothing new.
 */
export function chooseReferrer<R extends { id: string; userId: string | null; status: string }>(
  typed: R | null,
  fromLink: R | null,
  customerUserId: string,
): R | null {
  for (const r of [typed, fromLink]) {
    if (r && r.status === "ACTIVE" && r.userId !== customerUserId) return r;
  }
  return null;
}
