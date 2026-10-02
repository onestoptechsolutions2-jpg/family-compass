import { afterEach, describe, expect, it, vi } from "vitest";

import { hitLimit, trackedKeys } from "./rate-limit";

afterEach(() => vi.useRealTimers());

describe("hitLimit", () => {
  it("allows up to the limit, then refuses", () => {
    const k = `a-${Math.random()}`;
    expect([1, 2, 3].map(() => hitLimit(k, 3, 60))).toEqual([true, true, true]);
    expect(hitLimit(k, 3, 60)).toBe(false);
  });

  it("lets someone back in when the window has passed", () => {
    vi.useFakeTimers();
    const k = `b-${Math.random()}`;
    expect(hitLimit(k, 1, 10)).toBe(true);
    expect(hitLimit(k, 1, 10)).toBe(false);
    vi.advanceTimersByTime(11_000);
    expect(hitLimit(k, 1, 10)).toBe(true);
  });

  it("keeps separate counts per key", () => {
    const a = `c-${Math.random()}`;
    const b = `d-${Math.random()}`;
    expect(hitLimit(a, 1, 60)).toBe(true);
    expect(hitLimit(a, 1, 60)).toBe(false);
    expect(hitLimit(b, 1, 60)).toBe(true);
  });

  it("cannot be made to remember an unbounded number of keys", () => {
    for (let i = 0; i < 60_000; i++) hitLimit(`flood-${i}`, 5, 3600);
    expect(trackedKeys()).toBeLessThanOrEqual(21_000);
  });

  it("forgets keys whose window has run out", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 400; i++) hitLimit(`old-${i}`, 5, 1);
    vi.advanceTimersByTime(5_000);
    const before = trackedKeys();
    for (let i = 0; i < 600; i++) hitLimit(`new-${i}`, 5, 3600); // enough calls to trigger a sweep
    expect(trackedKeys()).toBeLessThan(before + 600);
  });
});
