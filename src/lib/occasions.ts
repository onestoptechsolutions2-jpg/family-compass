/**
 * Suggested "occasion / event" labels for photo uploads. Free text is still
 * allowed — this only seeds the autocomplete. Ordered roughly by how often a
 * family archive uses them, with a Kenyan church/community leaning.
 */
export const COMMON_OCCASIONS = [
  "Portrait",
  "Wedding",
  "Traditional wedding (ruracio / dowry)",
  "Engagement",
  "Baptism",
  "Christening",
  "First communion",
  "Confirmation",
  "Graduation",
  "School days",
  "Birthday",
  "Anniversary",
  "Family reunion",
  "Homecoming",
  "Harambee / fundraiser",
  "Church service",
  "Ordination",
  "Christmas",
  "Easter",
  "Naming ceremony",
  "Housewarming",
  "Farewell / send-off",
  "Retirement",
  "Funeral",
  "Memorial service",
  "Burial",
  "Military service",
  "Work / office",
  "Travel",
] as const;

export type CommonOccasion = (typeof COMMON_OCCASIONS)[number];
