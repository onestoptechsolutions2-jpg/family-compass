import { describe, expect, it } from "vitest";

import { checkNameCompleteness } from "./person";

const name = (first: string, surname: string) => [
  { type: "BIRTH" as const, preferred: true, order: 0, first, surname, surnamePrefix: null, nick: null, suffix: null, title: null },
];

describe("checkNameCompleteness", () => {
  it("passes a three-token name with a family name", () => {
    const r = checkNameCompleteness(name("Joash Otieno", "Odhiambo"));
    expect(r.ok).toBe(true);
    expect(r.tokenCount).toBe(3);
    expect(r.hasFamilyName).toBe(true);
  });

  it("fails a two-token name (given + surname only)", () => {
    const r = checkNameCompleteness(name("Joash", "Odhiambo"));
    expect(r.ok).toBe(false);
    expect(r.tokenCount).toBe(2);
  });

  it("fails when there's no family name at all", () => {
    const r = checkNameCompleteness(name("Joash Otieno Junior", ""));
    expect(r.ok).toBe(false);
    expect(r.hasFamilyName).toBe(false);
  });

  it("flags the given name and surname being the same word", () => {
    const r = checkNameCompleteness(name("Otieno", "Otieno"));
    expect(r.ok).toBe(false);
    expect(r.duplicateTokens).toBe(true);
  });

  it("flags a repeated token even inside a multi-word given name", () => {
    const r = checkNameCompleteness(name("Otieno Otieno", "Odhiambo"));
    expect(r.duplicateTokens).toBe(true);
  });

  it("is case-insensitive when comparing tokens", () => {
    const r = checkNameCompleteness(name("otieno", "Otieno"));
    expect(r.duplicateTokens).toBe(true);
  });

  it("handles no name at all without throwing", () => {
    const r = checkNameCompleteness([]);
    expect(r.ok).toBe(false);
    expect(r.tokenCount).toBe(0);
  });
});
