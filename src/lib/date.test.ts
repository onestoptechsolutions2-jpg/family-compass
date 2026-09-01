import { describe, expect, it } from "vitest";

import { DateModifier, DateQuality } from "@prisma/client";

import { dateSortKey, parseFuzzyDate, parseISODateInput, yearOf } from "./date";

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

describe("parseFuzzyDate", () => {
  const p = parseFuzzyDate;

  it("full dates → EXACT, no leftover text", () => {
    for (const s of ["1948-03-12", "12 March 1948", "12 Mar 1948", "March 12, 1948", "12/03/1948"]) {
      const d = p(s);
      expect([d.dateYear, d.dateMonth, d.dateDay]).toEqual([1948, 3, 12]);
      expect(d.dateModifier).toBe(DateModifier.EXACT);
      expect(d.dateText).toBeNull();
    }
  });

  it("partial: year, and month+year", () => {
    expect(p("1948")).toMatchObject({ dateYear: 1948, dateMonth: null, dateDay: null });
    expect(p("March 1948")).toMatchObject({ dateYear: 1948, dateMonth: 3, dateDay: null });
    expect(p("1948-03")).toMatchObject({ dateYear: 1948, dateMonth: 3, dateDay: null });
  });

  it("modifiers", () => {
    expect(p("about 1950")).toMatchObject({ dateModifier: DateModifier.ABOUT, dateYear: 1950 });
    expect(p("c. 1950")).toMatchObject({ dateModifier: DateModifier.ABOUT, dateYear: 1950 });
    expect(p("before 1960")).toMatchObject({ dateModifier: DateModifier.BEFORE, dateYear: 1960 });
    expect(p("aft 1972")).toMatchObject({ dateModifier: DateModifier.AFTER, dateYear: 1972 });
    expect(p("<1900")).toMatchObject({ dateModifier: DateModifier.BEFORE, dateYear: 1900 });
  });

  it("decade → about + estimated, keeps text", () => {
    const d = p("1950s");
    expect(d).toMatchObject({
      dateYear: 1950,
      dateModifier: DateModifier.ABOUT,
      dateQuality: DateQuality.ESTIMATED,
      dateText: "1950s",
    });
  });

  it("range", () => {
    const d = p("between 1948 and 1952");
    expect([d.dateYear, d.dateYear2, d.dateModifier]).toEqual([1948, 1952, DateModifier.RANGE]);
    expect(p("1948-52")).toMatchObject({ dateYear: 1948, dateYear2: 1952 });
  });

  it("unparseable → text only, still counts", () => {
    const d = p("the rainy season we moved");
    expect(d.any).toBe(true);
    expect(d.dateYear).toBeNull();
    expect(d.dateText).toBe("the rainy season we moved");
  });

  it("empty → nothing", () => {
    expect(p("").any).toBe(false);
  });
});
