import { DateModifier, DateQuality } from "@prisma/client";

export type StructuredDate = {
  dateModifier: DateModifier;
  dateQuality: DateQuality;
  dateYear: number | null;
  dateMonth: number | null;
  dateDay: number | null;
  dateYear2: number | null;
  dateMonth2: number | null;
  dateDay2: number | null;
  dateText: string | null;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const EMPTY_DATE: StructuredDate = {
  dateModifier: DateModifier.NONE,
  dateQuality: DateQuality.NONE,
  dateYear: null,
  dateMonth: null,
  dateDay: null,
  dateYear2: null,
  dateMonth2: null,
  dateDay2: null,
  dateText: null,
};

function part(y: number | null, m: number | null, d: number | null): string {
  if (!y && !m && !d) return "";
  const bits: string[] = [];
  if (d && m) bits.push(String(d));
  if (m) bits.push(MONTHS[m - 1] ?? String(m));
  if (y) bits.push(String(y));
  return bits.join(" ");
}

/** Human string for a structured date, or "" when empty. */
export function formatDate(dt: Partial<StructuredDate> | null | undefined): string {
  if (!dt) return "";
  const a = part(dt.dateYear ?? null, dt.dateMonth ?? null, dt.dateDay ?? null);
  const b = part(dt.dateYear2 ?? null, dt.dateMonth2 ?? null, dt.dateDay2 ?? null);
  const quality =
    dt.dateQuality === DateQuality.ESTIMATED
      ? "est. "
      : dt.dateQuality === DateQuality.CALCULATED
        ? "calc. "
        : "";

  let core: string;
  switch (dt.dateModifier) {
    case DateModifier.BEFORE:
      core = a ? `before ${a}` : "";
      break;
    case DateModifier.AFTER:
      core = a ? `after ${a}` : "";
      break;
    case DateModifier.ABOUT:
      core = a ? `about ${a}` : "";
      break;
    case DateModifier.RANGE:
      core = a && b ? `between ${a} and ${b}` : a || b;
      break;
    case DateModifier.SPAN:
      core = a && b ? `from ${a} to ${b}` : a || b;
      break;
    default:
      core = a;
  }
  const out = (quality + core).trim();
  return out || (dt.dateText ?? "");
}

/** ISO-ish sortable key ("1994-06-30", "1994-06", "1994", "") from the first part. */
export function dateSortKey(dt: Partial<StructuredDate> | null | undefined): string {
  if (!dt?.dateYear) return dt?.dateText ? `~${dt.dateText}` : "";
  const y = String(dt.dateYear).padStart(4, "0");
  const m = dt.dateMonth ? String(dt.dateMonth).padStart(2, "0") : "00";
  const d = dt.dateDay ? String(dt.dateDay).padStart(2, "0") : "00";
  return `${y}-${m}-${d}`;
}

export function yearOf(dt: Partial<StructuredDate> | null | undefined): number | null {
  return dt?.dateYear ?? null;
}

/** Parse an <input type="date"> value (YYYY-MM-DD) into date parts. */
export function parseISODateInput(value: string): Pick<
  StructuredDate,
  "dateYear" | "dateMonth" | "dateDay"
> {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return { dateYear: null, dateMonth: null, dateDay: null };
  return { dateYear: Number(m[1]), dateMonth: Number(m[2]), dateDay: Number(m[3]) };
}
