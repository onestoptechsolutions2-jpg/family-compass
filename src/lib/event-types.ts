/**
 * Person-scoped genealogy event types offered in the "Add event" menu.
 * Family events (Marriage, Divorce…) are edited from the family page.
 */
export const PERSON_EVENT_TYPES = [
  "Birth",
  "Death",
  "Burial",
  "Cremation",
  "Baptism",
  "Christening",
  "Adoption",
  "Graduation",
  "Retirement",
  "Emigration",
  "Immigration",
  "Naturalization",
  "Census",
  "Occupation",
  "Residence",
  "Education",
  "Religion",
  "Other",
] as const;

export type PersonEventType = (typeof PERSON_EVENT_TYPES)[number];

export function isPersonEventType(v: string): v is PersonEventType {
  return (PERSON_EVENT_TYPES as readonly string[]).includes(v);
}
