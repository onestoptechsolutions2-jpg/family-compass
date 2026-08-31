import { describe, it, expect } from "vitest";

import { relationScore, orderPair } from "@/lib/relationships";

describe("orderPair", () => {
  it("is canonical regardless of argument order", () => {
    expect(orderPair("b", "a")).toEqual(["a", "b"]);
    expect(orderPair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("relationScore", () => {
  const recent = new Date();
  const old = new Date(Date.now() - 5 * 365 * 86_400_000);

  it("is zero with no shared history", () => {
    expect(relationScore({ memories: 0, confirmations: 0, reciprocated: false, lastInteractionAt: null })).toBe(0);
  });

  it("grows with shared memories", () => {
    const a = relationScore({ memories: 2, confirmations: 0, reciprocated: false, lastInteractionAt: recent });
    const b = relationScore({ memories: 8, confirmations: 0, reciprocated: false, lastInteractionAt: recent });
    expect(b).toBeGreaterThan(a);
  });

  it("reciprocated ties outrank one-sided ones", () => {
    const one = relationScore({ memories: 4, confirmations: 0, reciprocated: false, lastInteractionAt: recent });
    const both = relationScore({ memories: 4, confirmations: 0, reciprocated: true, lastInteractionAt: recent });
    expect(both).toBeGreaterThan(one);
  });

  it("decays as the last shared memory recedes", () => {
    const fresh = relationScore({ memories: 6, confirmations: 0, reciprocated: true, lastInteractionAt: recent });
    const stale = relationScore({ memories: 6, confirmations: 0, reciprocated: true, lastInteractionAt: old });
    expect(stale).toBeLessThan(fresh);
  });

  it("both people putting their own words to a memory lifts it", () => {
    const plain = relationScore({ memories: 3, confirmations: 0, reciprocated: false, lastInteractionAt: recent });
    const annotated = relationScore({ memories: 3, confirmations: 4, reciprocated: false, lastInteractionAt: recent });
    expect(annotated).toBeGreaterThan(plain);
  });
});
