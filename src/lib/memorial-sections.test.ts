import { describe, expect, it } from "vitest";

import { CONTRIBUTION_SECTIONS, MERGE_TARGET, sectionLabel } from "./memorial-sections";

describe("memorial contribution sections", () => {
  it("every section has a label and a merge target", () => {
    for (const s of CONTRIBUTION_SECTIONS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(["eulogy", "serviceText"]).toContain(MERGE_TARGET[s.value]);
    }
  });

  it("programme notes merge into the service text; memories into the eulogy", () => {
    expect(MERGE_TARGET.programme).toBe("serviceText");
    expect(MERGE_TARGET.memory).toBe("eulogy");
    expect(MERGE_TARGET.tribute).toBe("eulogy");
  });

  it("sectionLabel falls back to the raw value", () => {
    expect(sectionLabel("memory")).toBe("A memory");
    expect(sectionLabel("whatever")).toBe("whatever");
  });
});
