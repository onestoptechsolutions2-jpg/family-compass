import { describe, expect, it } from "vitest";

import { ACTIVITY_KINDS, activityKind, activityKindMeta } from "./activity";

describe("activity kinds", () => {
  it("maps object types to a known kind", () => {
    expect(activityKind("person")).toBe("genealogy");
    expect(activityKind("family")).toBe("genealogy");
    expect(activityKind("memorial")).toBe("memorial");
    expect(activityKind("guestbook")).toBe("memorial");
    expect(activityKind("chama")).toBe("chama");
    expect(activityKind("share")).toBe("sharing");
    expect(activityKind("media")).toBe("media");
    expect(activityKind("backup")).toBe("system");
  });

  it("is case-insensitive and falls back to other", () => {
    expect(activityKind("PERSON")).toBe("genealogy");
    expect(activityKind("whatever")).toBe("other");
  });

  it("every kind id resolves to metadata with an emoji", () => {
    for (const k of ACTIVITY_KINDS) {
      const m = activityKindMeta(k.id);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.emoji.length).toBeGreaterThan(0);
    }
    expect(activityKindMeta("other").label).toBe("Other");
  });
});
