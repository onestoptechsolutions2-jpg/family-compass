import { describe, expect, it } from "vitest";

import { nameSimilarity, birthYearProximity, clanOrCommunityMatch, regionMatch } from "./identity";

describe("nameSimilarity", () => {
  it("scores an exact match at the max", () => {
    expect(nameSimilarity("Joash Otieno", "Joash Otieno")).toBe(40);
  });

  it("tolerates spelling drift", () => {
    const score = nameSimilarity("Joash Otieno", "Joash Otiono");
    expect(score).toBeGreaterThan(25);
    expect(score).toBeLessThan(40);
  });

  it("scores unrelated names low", () => {
    expect(nameSimilarity("Joash Otieno", "Mary Wanjiru")).toBeLessThan(10);
  });
});

describe("birthYearProximity", () => {
  it("is neutral, not penalized, when either year is unknown", () => {
    expect(birthYearProximity(null, 1980)).toBe(0);
    expect(birthYearProximity(1980, null)).toBe(0);
  });

  it("rewards an exact match highest, then decays with distance", () => {
    expect(birthYearProximity(1980, 1980)).toBe(20);
    expect(birthYearProximity(1980, 1982)).toBe(10);
    expect(birthYearProximity(1980, 1984)).toBe(5);
    expect(birthYearProximity(1980, 1990)).toBe(0);
  });
});

describe("clanOrCommunityMatch", () => {
  it("matches clan case/accent-insensitively via normalizeClan", () => {
    expect(clanOrCommunityMatch("Abasakwa", null, "abasakwa", null)).toBe(15);
  });

  it("matches community case-insensitively", () => {
    expect(clanOrCommunityMatch(null, "Luo", null, "luo")).toBe(15);
  });

  it("scores zero when neither side offers enough to compare", () => {
    expect(clanOrCommunityMatch(null, null, "abasakwa", "luo")).toBe(0);
    expect(clanOrCommunityMatch("Abasakwa", null, null, null)).toBe(0);
  });
});

describe("regionMatch", () => {
  it("matches a substring case-insensitively", () => {
    expect(regionMatch("kakamega", "Kakamega County")).toBe(10);
  });

  it("scores zero when either side is missing", () => {
    expect(regionMatch(null, "Kakamega County")).toBe(0);
    expect(regionMatch("Kakamega", null)).toBe(0);
  });
});
