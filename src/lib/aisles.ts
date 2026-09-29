/** The shop's aisles. A product belongs to one. */
export const AISLES = [
  { key: "memorial_stone", label: "Memorial and stone", blurb: "Tombstone trees, plaques and memorial pieces" },
  { key: "wall_art", label: "Wall art", blurb: "Family trees in wood, acrylic, metal and print" },
  { key: "books_print", label: "Books and print", blurb: "Family books, memorial books, calendars and cards" },
  { key: "events_merch", label: "Events and merchandise", blurb: "Weddings, reunions, T-shirts and name badges" },
] as const;

export type AisleKey = (typeof AISLES)[number]["key"];
export const aisleLabel = (k: string) => AISLES.find((a) => a.key === k)?.label ?? "";
