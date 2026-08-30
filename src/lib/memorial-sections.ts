/** Sections a memorial contribution can target, and where each is merged. */
export const CONTRIBUTION_SECTIONS = [
  { value: "memory", label: "A memory" },
  { value: "tribute", label: "A tribute" },
  { value: "correction", label: "A correction" },
  { value: "programme", label: "Funeral programme note" },
  { value: "other", label: "Something else" },
] as const;

export const MERGE_TARGET: Record<string, "eulogy" | "serviceText"> = {
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
