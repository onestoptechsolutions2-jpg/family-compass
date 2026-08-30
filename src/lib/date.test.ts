import { describe, expect, it } from "vitest";

import { dateSortKey, parseISODateInput, yearOf } from "./date";

describe("parseISODateInput", () => {
  it("splits a YYYY-MM-DD value", () => {
    expect(parseISODateInput("1948-03-12")).toEqual({ dateYear: 1948, dateMonth: 3, dateDay: 12 });
  });
  it("returns nulls for anything else", () => {
    expect(parseISODateInput("March 1948")).toEqual({ dateYear: null, dateMonth: null, dateDay: null });
    expect(parseISODateInput("")).toEqual({ dateYear: null, dateMonth: null, dateDay: null });
  });
});

describe("dateSortKey", () => {
  it("zero-pads year/month/day so keys sort chronologically", () => {
    expect(dateSortKey({ dateYear: 1948, dateMonth: 3, dateDay: 12 })).toBe("1948-03-12");
    expect(dateSortKey({ dateYear: 900 })).toBe("0900-00-00");
    expect(dateSortKey({ dateYear: 1948, dateMonth: 3 }) < dateSortKey({ dateYear: 1948, dateMonth: 12 })).toBe(true);
  });
  it("prefixes free-text dates with ~ and empty for nothing", () => {
    expect(dateSortKey({ dateText: "spring 1950" })).toBe("~spring 1950");
    expect(dateSortKey(null)).toBe("");
  });
});

describe("yearOf", () => {
  it("returns the year or null", () => {
    expect(yearOf({ dateYear: 2001 })).toBe(2001);
    expect(yearOf({ dateText: "x" })).toBeNull();
  });
});
