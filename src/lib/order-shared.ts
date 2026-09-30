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
  /** answers to "is this the same person already in your family?": normalised name -> person id, or "new" */
  matches?: Record<string, string>;
  materialKey?: string;
  sizeKey?: string;
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
