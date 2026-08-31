import { describe, expect, it } from "vitest";

import { isProfileClaimable } from "./claim-eligibility";

describe("isProfileClaimable", () => {
  it("living, unclaimed profile is claimable", () => {
    expect(isProfileClaimable({ claimedByUserId: null, deceased: false })).toBe(true);
    expect(isProfileClaimable({})).toBe(true);
  });

  it("a deceased profile is never claimable — no 'This is me'", () => {
    expect(isProfileClaimable({ deceased: true })).toBe(false);
    expect(isProfileClaimable({ deceased: true, claimedByUserId: null })).toBe(false);
    // even a stale leftover claim on a dead person stays not-claimable
    expect(isProfileClaimable({ deceased: true, claimedByUserId: "u1" })).toBe(false);
  });

  it("an already-claimed profile is not claimable", () => {
    expect(isProfileClaimable({ claimedByUserId: "u1", deceased: false })).toBe(false);
  });

  it("a redacted living person in a shared tree is not claimable", () => {
    expect(isProfileClaimable({ redactedName: "Living Omondi" })).toBe(false);
    expect(isProfileClaimable({ redactedName: "Asha Omondi" })).toBe(true);
  });
});
