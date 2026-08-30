/** Sections a memorial contribution can target, and where each is merged. */
export const CONTRIBUTION_SECTIONS = [
  { value: "memory", label: "A memory" },
  { value: "tribute", label: "A tribute" },
  { value: "biography", label: "Life details (education, work, faith…)" },
  { value: "correction", label: "A correction" },
  { value: "programme", label: "Funeral programme note" },
  { value: "note", label: "A side note for the family" },
  { value: "other", label: "Something else" },
] as const;

/**
 * Where an ACCEPTED contribution is merged. Sections not listed here
 * (e.g. "note", "biography") are accepted for the editor to read and act on,
 * but not auto-merged into the public copy.
 */
export const MERGE_TARGET: Record<string, "eulogy" | "serviceText" | undefined> = {
  memory: "eulogy",
  tribute: "eulogy",
  eulogy: "eulogy",
  correction: "eulogy",
  programme: "serviceText",
  service: "serviceText",
  other: "eulogy",
};

export function sectionLabel(value: string): string {
  return CONTRIBUTION_SECTIONS.find((s) => s.value === value)?.label ?? value;
}
