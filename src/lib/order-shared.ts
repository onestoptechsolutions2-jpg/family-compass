// Pure order helpers: no database, safe to import from the browser.

/** What the wizard collects, kept on OrderItem.options until the account step. */
export type DraftOptions = {
  first?: string;
  surname?: string;
  birth?: string;
  death?: string;
  place?: string;
  epitaph?: string;
  parents?: string;
  /** the father's parents, then the mother's parents, one name per line */
  fatherParents?: string;
  motherParents?: string;
  spouse?: string;
  children?: string;
  siblings?: string;
  /** the spouse's parents (wedding tree), one per line */
  spouseParents?: string;
  /** event or tree title printed on the piece, e.g. Kamau Family Reunion 2026 */
  title?: string;
  /** calendar year, wedding date or event year */
  year?: string;
  /** calendar: one per line, "Name, 3 March 1985" */
  birthdays?: string;
  /** badges: one per line, "Name, relation to the host" */
  attendees?: string;
  /** programme: when and where the service is, e.g. "Saturday 14 November 2026, 10am" */
  serviceWhen?: string;
  /** programme: the day of the service, yyyy-mm-dd, picked in the chat; serviceWhen is made from it */
  serviceDate?: string;
  /** programme: what time it starts, as they typed it, e.g. "10am" */
  serviceTime?: string;
  /** programme: "whatsapp" when the family will send the inside pages on WhatsApp */
  insideLater?: string;
  venue?: string;
  /** programme: the order of service, one per line, "10:00 Arrival of the body" */
  service?: string;
  /** programme: their life story (paragraphs) */
  bio?: string;
  /** programme: hymns, one per line */
  hymns?: string;
  /** programme: short tributes, one per line */
  tribute?: string;
  /** programme: the family's thank-you note on the back */
  thanks?: string;
  /** programme: contribution and committee contacts, one per line, e.g. "M-Pesa Paybill 123456, account Kamau" */
  contacts?: string;
  /** programme: where funeral contributions go, the family's own M-Pesa (see fund-destination) */
  fundKind?: string;
  fundNumber?: string;
  fundAccount?: string;
  fundName?: string;
  /** a photo uploaded for the piece (the programme cover): a DraftPhoto id */
  photoId?: string;
  /** answers to "is this the same person already in your family?": normalised name -> person id, or "new" */
  matches?: Record<string, string>;
  materialKey?: string;
  sizeKey?: string;
  /** colour and finish: granite shade, wood tone, paper, frame or shirt colour */
  finishKey?: string;
  /** pages in a booklet, and how many copies are printed */
  pagesKey?: string;
  copiesKey?: string;
  relation?: "child" | "spouse" | "sibling" | "other";
};

/** One name per line; blank lines dropped. */
export function lines(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);
}

/**
 * A couple in two fixed positions, first then second (father, mother). Unlike
 * lines(), an empty first line keeps its place, so "\nMary" is a mother with no
 * father recorded, and she is never mistaken for the father.
 */
export function pair(text: string | undefined): [string | undefined, string | undefined] {
  const [a = "", b = ""] = (text ?? "").split(/\r?\n/).map((l) => l.trim());
  return [a || undefined, b || undefined];
}

export function splitName(full: string): { first: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] ?? "", surname: "" };
  return { first: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] ?? "" };
}

/** One key for a name, so "Ann  Kamau" and "ann kamau" are the same person. */
export const normaliseName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

/** Full payment up front: nothing is made until the whole price is paid (docs/commerce/DECISIONS.md). */
export const PAY_UP_FRONT_SHARE = 1;

/** What the customer pays now, rounded up to the nearest 100 shillings. Shown and charged alike. */
export function amountDueNow(totalKes: number): number {
  return Math.ceil((totalKes * PAY_UP_FRONT_SHARE) / 100) * 100;
}

/** Printing and delivery take this many days from payment, countrywide. */
export const DELIVERY_DAYS = 2;

const isDay = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));

/** "2026-11-14" → "Saturday 14 November 2026" (or "Sat 14 Nov" short); anything else back as it came. */
export function dayText(iso: string, short = false): string {
  if (!isDay(iso)) return iso;
  const d = new Date(`${iso}T12:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  const date = part(short ? { day: "numeric", month: "short" } : { day: "numeric", month: "long", year: "numeric" });
  return `${part({ weekday: short ? "short" : "long" })} ${date}`;
}

/** The service line printed on the programme, from the day picked and the time typed. */
export function serviceWhenText(day: string | undefined, time: string | undefined): string | null {
  if (!isDay(day)) return null;
  const t = time?.trim();
  return t ? `${dayText(day)}, ${t}` : dayText(day);
}

/** Today in Kenya, as yyyy-mm-dd. */
export function kenyaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * When an order paid now arrives, against the day of the service:
 * "early" (at least a day before), "same-day" (on the day itself), "late" (after it),
 * or "open" when we do not know the service day.
 */
export function arrival(serviceDate: string | undefined, now: Date = new Date()): { by: string; fit: "early" | "same-day" | "late" | "open" } {
  const t = new Date(`${kenyaToday(now)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + DELIVERY_DAYS);
  const by = t.toISOString().slice(0, 10);
  if (!isDay(serviceDate)) return { by, fit: "open" };
  return { by, fit: by < serviceDate ? "early" : by === serviceDate ? "same-day" : "late" };
}
