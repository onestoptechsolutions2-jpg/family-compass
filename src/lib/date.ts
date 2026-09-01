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

const MONTH_NAMES: Record<string, number> = {};
[
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
].forEach((n, i) => {
  MONTH_NAMES[n] = i + 1;
  MONTH_NAMES[n.slice(0, 3)] = i + 1;
});
MONTH_NAMES["sept"] = 9;

const clampM = (n: number) => (n >= 1 && n <= 12 ? n : null);
const clampD = (n: number) => (n >= 1 && n <= 31 ? n : null);

/** Pull a Y / Y-M / Y-M-D out of one date token (no modifier words). */
function parseOnePart(s: string): { y: number | null; m: number | null; d: number | null } {
  const t = s.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " ");
  let x: RegExpExecArray | null;

  // 1948-03-12  /  1948/03/12  /  1948.3.12
  if ((x = /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/.exec(t)))
    return { y: +x[1]!, m: clampM(+x[2]!), d: clampD(+x[3]!) };
  // 12-03-1948  /  12/03/1948   (day first)
  if ((x = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t)))
    return { y: +x[3]!, m: clampM(+x[2]!), d: clampD(+x[1]!) };
  // 1948-03  /  03/1948
  if ((x = /^(\d{4})[-/](\d{1,2})$/.exec(t))) return { y: +x[1]!, m: clampM(+x[2]!), d: null };
  if ((x = /^(\d{1,2})[-/](\d{4})$/.exec(t))) return { y: +x[2]!, m: clampM(+x[1]!), d: null };
  // 12 march 1948  /  march 1948  /  12 mar 1948  /  mar 1948
  if ((x = /^(?:(\d{1,2})\s+)?([a-z]+)\.?\s+(\d{4})$/.exec(t))) {
    const mon = MONTH_NAMES[x[2]!];
    if (mon) return { y: +x[3]!, m: mon, d: x[1] ? clampD(+x[1]!) : null };
  }
  // march 12, 1948  /  march 1948
  if ((x = /^([a-z]+)\.?\s+(?:(\d{1,2})\s+)?(\d{4})$/.exec(t))) {
    const mon = MONTH_NAMES[x[1]!];
    if (mon) return { y: +x[3]!, m: mon, d: x[2] ? clampD(+x[2]!) : null };
  }
  // bare year
  if ((x = /^(\d{3,4})$/.exec(t))) return { y: +x[1]!, m: null, d: null };
  return { y: null, m: null, d: null };
}

/**
 * Parse a free-text date the way a family actually writes one — full,
 * partial or approximate — into structured parts:
 *   "12 March 1948", "1948-03-12"      → exact
 *   "March 1948", "1948"               → year (+month)
 *   "about 1950", "c. 1950", "~1950"   → ABOUT
 *   "before 1960", "aft 1972", "<1900" → BEFORE / AFTER
 *   "1950s"                            → ABOUT + estimated, year 1950
 *   "between 1948 and 1952", "1948-52" → RANGE
 * Anything it can't parse is kept verbatim in `dateText`.
 */
export function parseFuzzyDate(raw: string): StructuredDate & { any: boolean } {
  const original = raw.trim();
  if (!original) return { ...EMPTY_DATE, any: false };

  let s = original.toLowerCase();
  let modifier: DateModifier = DateModifier.NONE;
  let quality: DateQuality = DateQuality.NONE;

  // range: "between X and Y" | "X to Y" | "1948-1952" | "1948-52"
  // ("1948-03" is a year-month, not a range — the 2-digit form only counts
  //  when the second number can't be a month.)
  let rangeM: RegExpExecArray | null;
  if (
    (rangeM =
      /^(?:between\s+)?(.+?)\s+(?:and|to|[-–])\s+(.+)$/.exec(s) ??
      /^(\d{4})\s*[-–]\s*(\d{4})$/.exec(s) ??
      /^(\d{4})\s*[-–]\s*((?:[2-9]\d|1[3-9]))$/.exec(s))
  ) {
    const a = parseOnePart(rangeM[1]!);
    let bStr = rangeM[2]!.trim();
    if (/^\d{2}$/.test(bStr) && a.y) bStr = String(Math.floor(a.y / 100)) + bStr; // "1948-52"
    const b = parseOnePart(bStr);
    if (a.y && b.y) {
      return {
        dateModifier: DateModifier.RANGE,
        dateQuality: DateQuality.NONE,
        dateYear: a.y, dateMonth: a.m, dateDay: a.d,
        dateYear2: b.y, dateMonth2: b.m, dateDay2: b.d,
        dateText: original,
        any: true,
      };
    }
  }

  const strip = (re: RegExp, mod: DateModifier) => {
    if (re.test(s)) {
      modifier = mod;
      s = s.replace(re, "").trim();
    }
  };
  strip(/^(?:about|abt|approx\.?|circa|ca\.?|c\.|~)\s*/, DateModifier.ABOUT);
  strip(/^(?:before|bef\.?|pre[- ]?)\s*/, DateModifier.BEFORE);
  strip(/^</, DateModifier.BEFORE);
  strip(/^(?:after|aft\.?|post[- ]?)\s*/, DateModifier.AFTER);
  strip(/^>/, DateModifier.AFTER);
  if (/^(?:est\.?|estimated|guess)\s*/.test(s)) {
    quality = DateQuality.ESTIMATED;
    s = s.replace(/^(?:est\.?|estimated|guess)\s*/, "").trim();
  }

  // decade: "1950s"
  const dec = /^(\d{3,4})s$/.exec(s);
  if (dec) {
    return {
      ...EMPTY_DATE,
      dateModifier: modifier === DateModifier.NONE ? DateModifier.ABOUT : modifier,
      dateQuality: DateQuality.ESTIMATED,
      dateYear: +dec[1]!,
      dateText: original,
      any: true,
    };
  }

  const p = parseOnePart(s);
  if (!p.y) {
    return { ...EMPTY_DATE, dateModifier: modifier, dateQuality: quality, dateText: original, any: true };
  }

  const exact = modifier === DateModifier.NONE && quality === DateQuality.NONE && p.m != null && p.d != null;
  return {
    ...EMPTY_DATE,
    dateModifier: exact ? DateModifier.EXACT : modifier,
    dateQuality: quality,
    dateYear: p.y,
    dateMonth: p.m,
    dateDay: p.d,
    // keep the phrasing unless it's a clean exact date we can rebuild
    dateText: exact ? null : original,
    any: true,
  };
}
