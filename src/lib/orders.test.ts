import { describe, expect, it } from "vitest";

// Pure helpers only; importing them pulls in db, so mock the modules that
// need a database or env at import time.
import { vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/person-write", () => ({}));
vi.mock("@/lib/payments", () => ({}));
vi.mock("@/lib/workspace", () => ({}));

import { amountDueNow, lines, splitName, unitPrice } from "./orders";

describe("orders helpers", () => {
  it("adds material and size to the base price", () => {
    const po = {
      materials: [{ key: "granite", label: "Granite", addKes: 5000 }],
      sizes: [{ key: "large", label: "Large", addKes: 2000 }],
    };
    expect(unitPrice(30000, po, { materialKey: "granite", sizeKey: "large" })).toBe(37000);
    expect(unitPrice(30000, po, {})).toBe(30000);
    expect(unitPrice(30000, null, { materialKey: "x" })).toBe(30000);
  });

  it("takes the full price up front, rounded up to KES 100", () => {
    expect(amountDueNow(30000)).toBe(30000);
    expect(amountDueNow(30150)).toBe(30200);
  });

  it("splits one name per line and drops blanks", () => {
    expect(lines("Mary Wanjiku\n\n  Peter Kamau \r\n")).toEqual(["Mary Wanjiku", "Peter Kamau"]);
    expect(lines(undefined)).toEqual([]);
  });

  it("splits a full name into first names and surname", () => {
    expect(splitName("Mary Wanjiku")).toEqual({ first: "Mary", surname: "Wanjiku" });
    expect(splitName("Mary Wanjiku Kamau")).toEqual({ first: "Mary Wanjiku", surname: "Kamau" });
    expect(splitName("Mary")).toEqual({ first: "Mary", surname: "" });
  });
});
