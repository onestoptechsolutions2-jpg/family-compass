import { describe, it, expect } from "vitest";

import { canEditPersonRecord } from "./rbac-rules";

describe("canEditPersonRecord", () => {
  it("lets a manager edit anyone's profile", () => {
    expect(canEditPersonRecord("EDITOR", "someone-else", "me")).toBe(true);
    expect(canEditPersonRecord("OWNER", null, "me")).toBe(true);
  });

  it("lets a person edit their own claimed profile regardless of role", () => {
    expect(canEditPersonRecord("VIEWER", "me", "me")).toBe(true);
    expect(canEditPersonRecord("CONTRIBUTOR", "me", "me")).toBe(true);
  });

  it("blocks a non-manager from editing someone else's profile", () => {
    expect(canEditPersonRecord("CONTRIBUTOR", "someone-else", "me")).toBe(false);
    expect(canEditPersonRecord("VIEWER", "someone-else", "me")).toBe(false);
  });

  it("blocks a non-manager from editing an unclaimed profile", () => {
    expect(canEditPersonRecord("CONTRIBUTOR", null, "me")).toBe(false);
  });
});
