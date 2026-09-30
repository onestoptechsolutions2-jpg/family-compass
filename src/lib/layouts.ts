import type { DraftOptions } from "@/lib/order-shared";

/**
 * A product's layout decides what its piece looks like and which questions the
 * customer is asked. Everything else (cart, payment, partners) is the same for
 * every layout, so a new product is a layout plus a row in the catalogue.
 */
export type Layout = "tree" | "wedding" | "banner" | "card" | "calendar" | "badges" | "shirt";
export type Pathway = "LIVING" | "REMEMBERED";

export type Field = {
  key: keyof DraftOptions;
  label: string;
  hint?: string;
  placeholder?: string;
  /** a multi-line box; one entry per line */
  rows?: number;
  /** the "You are their" choice, which links the customer into the family */
  relation?: boolean;
};
export type Step = { title: string; intro?: string; fields: Field[] };

export const LAYOUT_LABEL: Record<Layout, string> = {
  tree: "Family tree",
  wedding: "Wedding family tree",
  banner: "Banner",
  card: "Memorial card",
  calendar: "Birthday calendar",
  badges: "Name badges",
  shirt: "T-shirt",
};

export const isLayout = (v: string): v is Layout => v in LAYOUT_LABEL;

/** The key that must be filled in before an item can be ordered. */
export function requiredKey(layout: Layout): keyof DraftOptions {
  return layout === "calendar" || layout === "badges" || layout === "shirt" ? "surname" : "first";
}
export function isReady(layout: Layout, o: DraftOptions): boolean {
  return Boolean(String(o[requiredKey(layout)] ?? "").trim());
}

const family = (living: boolean): Field[] => [
  { key: "parents", label: "Parents (father first, then mother)", rows: 3 },
  { key: "fatherParents", label: "Father's parents", rows: 3 },
  { key: "motherParents", label: "Mother's parents", rows: 3 },
  { key: "spouse", label: "Spouse", rows: 3 },
  { key: "children", label: "Children", rows: 3 },
  { key: "siblings", label: "Brothers and sisters", rows: 3 },
  ...(living ? [] : [{ key: "relation" as const, label: "You are their", relation: true }]),
];

/** The two question screens for a product (material and size, then review, follow). */
export function stepsFor(layout: Layout, pathway: Pathway): [Step, Step] {
  const living = pathway === "LIVING";
  const skip = "One name per line. Skip anything you do not know; you can add more later.";

  switch (layout) {
    case "wedding":
      return [
        {
          title: "Who is getting married?",
          fields: [
            { key: "first", label: "First name(s) of one partner" },
            { key: "surname", label: "Their surname" },
            { key: "spouse", label: "Their partner's full name", rows: 1 },
            { key: "year", label: "Wedding date or year", placeholder: "e.g. 14 December 2026" },
            { key: "title", label: "A title for the piece (optional)", placeholder: "e.g. The wedding of Ann and Tom" },
          ],
        },
        {
          title: "Bring the two families together",
          intro: skip,
          fields: [
            { key: "parents", label: "Their parents (father first, then mother)", rows: 3 },
            { key: "spouseParents", label: "Their partner's parents (father first, then mother)", rows: 3 },
            { key: "children", label: "Children, if any", rows: 3 },
            { key: "relation", label: "", relation: true },
          ],
        },
      ];
    case "banner":
      return [
        {
          title: "Your family banner",
          fields: [
            { key: "title", label: "Banner title", placeholder: "e.g. Kamau Family Reunion 2026" },
            { key: "first", label: "First name(s) of the family head" },
            { key: "surname", label: "Surname" },
            { key: "birth", label: "Birth year (optional)" },
          ],
        },
        { title: "Who should we show?", intro: skip, fields: family(true) },
      ];
    case "card":
      return [
        {
          title: "Who is this card for?",
          fields: [
            { key: "first", label: "First name(s)" },
            { key: "surname", label: "Surname" },
            { key: "birth", label: "Born (date or year)", placeholder: "e.g. 12 March 1948" },
            { key: "death", label: "Died (date or year)", placeholder: "e.g. 2026" },
            { key: "place", label: "Place of burial (optional)" },
            { key: "epitaph", label: "A verse or short line for the card (optional)", placeholder: "e.g. Gone from our sight, never from our hearts" },
          ],
        },
        {
          title: "Add their family (optional)",
          intro: "This builds their memorial page, which the QR code on the card opens. " + skip,
          fields: [
            { key: "parents", label: "Parents (father first, then mother)", rows: 2 },
            { key: "spouse", label: "Spouse", rows: 2 },
            { key: "children", label: "Children", rows: 3 },
            { key: "siblings", label: "Brothers and sisters", rows: 3 },
            { key: "relation", label: "You are their", relation: true },
          ],
        },
      ];
    case "calendar":
      return [
        {
          title: "Your family calendar",
          fields: [
            { key: "surname", label: "Family name", placeholder: "e.g. Kamau" },
            { key: "first", label: "Your first name(s)" },
            { key: "year", label: "Calendar year", placeholder: "e.g. 2027" },
            { key: "title", label: "A title (optional)", placeholder: "e.g. The Kamau Family" },
          ],
        },
        {
          title: "Birthdays and anniversaries",
          intro: "One per line: the name, a comma, then the day and month. Add the year if you want their age known. Example: Ann Kamau, 3 March 1985",
          fields: [{ key: "birthdays", label: "Birthdays and anniversaries", rows: 10 }],
        },
      ];
    case "badges":
      return [
        {
          title: "Your reunion",
          fields: [
            { key: "title", label: "Event name", placeholder: "e.g. Kamau Family Reunion 2026" },
            { key: "surname", label: "Family name" },
            { key: "first", label: "Host's first name(s)" },
            { key: "place", label: "Place (optional)" },
          ],
        },
        {
          title: "Who is coming?",
          intro: "One per line: the name, a comma, then how they are related to the host. Example: Peter Kamau, Uncle",
          fields: [{ key: "attendees", label: "Guests", rows: 10 }],
        },
      ];
    case "shirt":
      return [
        {
          title: "Your reunion T-shirt",
          fields: [
            { key: "surname", label: "Family name", placeholder: "e.g. Kamau" },
            { key: "title", label: "Line under the name", placeholder: "e.g. Family Reunion" },
            { key: "year", label: "Year", placeholder: "e.g. 2026" },
            { key: "place", label: "Place (optional)", placeholder: "e.g. Kakamega" },
            { key: "first", label: "Your first name(s) (so we can link this to your family)" },
          ],
        },
        {
          title: "Add your family (optional)",
          intro: "This builds the family page the QR code on the shirt opens. " + skip,
          fields: [
            { key: "parents", label: "Your parents (father first, then mother)", rows: 2 },
            { key: "spouse", label: "Spouse", rows: 2 },
            { key: "children", label: "Children", rows: 3 },
          ],
        },
      ];
    case "tree":
    default:
      return [
        {
          title: living ? "Whose family is this?" : "Who is this for?",
          fields: [
            { key: "first", label: living ? "Your first name(s)" : "First name(s)" },
            { key: "surname", label: living ? "Your surname" : "Surname" },
            { key: "birth", label: living ? "Your birth year (optional)" : "Born (date or year)", placeholder: living ? undefined : "e.g. 12 March 1948" },
            ...(living
              ? []
              : [
                  { key: "death" as const, label: "Died (date or year)", placeholder: "e.g. 2026" },
                  { key: "place" as const, label: "Place of passing or burial (optional)" },
                ]),
            { key: "epitaph", label: living ? "A title for your tree (optional)" : "A short line to carry on it (optional)" },
          ],
        },
        { title: "Who should we show?", intro: skip, fields: family(living) },
      ];
  }
}
