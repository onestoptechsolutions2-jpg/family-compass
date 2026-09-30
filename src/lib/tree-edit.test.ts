import { describe, expect, it } from "vitest";

import { lines, pair } from "./order-shared";
import { cleanName, emptySlots, filledSlots, getSlot, removeSlot, sanitizeBuilderOptions, setSlot, slotLabel } from "./tree-edit";

describe("pair: two positions that keep their place", () => {
  it("keeps a mother with no father as the mother", () => {
    expect(pair("\nMary")).toEqual([undefined, "Mary"]);
    expect(lines("\nMary")).toEqual(["Mary"]); // the old reading, which lost her place
  });
  it("reads a normal couple, a lone father and nothing", () => {
    expect(pair("Peter\nMary")).toEqual(["Peter", "Mary"]);
    expect(pair("Peter")).toEqual(["Peter", undefined]);
    expect(pair("")).toEqual([undefined, undefined]);
    expect(pair(undefined)).toEqual([undefined, undefined]);
    expect(pair("  Peter  \r\n  Mary ")).toEqual(["Peter", "Mary"]);
  });
});

describe("tapping the tree", () => {
  it("adds a mother without making her the father", () => {
    const o = setSlot({}, "mother", "Mary Wanjiku");
    expect(o.parents).toBe("\nMary Wanjiku");
    expect(getSlot(o, "mother")).toBe("Mary Wanjiku");
    expect(getSlot(o, "father")).toBe("");
  });

  it("adds a father afterwards and both are kept in place", () => {
    let o = setSlot({}, "mother", "Mary Wanjiku");
    o = setSlot(o, "father", "Peter Kamau");
    expect(pair(o.parents)).toEqual(["Peter Kamau", "Mary Wanjiku"]);
  });

  it("removing a parent removes their own parents from the tree", () => {
    let o = setSlot({}, "father", "Peter Kamau");
    o = setSlot(o, "gp:ff", "Old Kamau");
    o = setSlot(o, "gp:fm", "Old Wanjiru");
    expect(o.fatherParents).toBe("Old Kamau\nOld Wanjiru");
    o = removeSlot(o, "father");
    expect(o.parents).toBe("");
    expect(o.fatherParents).toBe("");
  });

  it("removing the mother leaves the father where he was", () => {
    let o = setSlot(setSlot({}, "father", "Peter"), "mother", "Mary");
    o = removeSlot(o, "mother");
    expect(o.parents).toBe("Peter");
    expect(pair(o.parents)).toEqual(["Peter", undefined]);
  });

  it("a grandparent needs a parent to hang off", () => {
    const start = {};
    expect(setSlot(start, "gp:ff", "Old Kamau")).toBe(start);
    const withFather = setSlot({}, "father", "Peter");
    expect(getSlot(setSlot(withFather, "gp:ff", "Old Kamau"), "gp:ff")).toBe("Old Kamau");
    expect(setSlot(withFather, "gp:mf", "Someone")).toBe(withFather); // no mother yet
  });

  it("keeps a mother's mother in her place when her father is unknown", () => {
    let o = setSlot({}, "mother", "Mary");
    o = setSlot(o, "gp:mm", "Njeri");
    expect(o.motherParents).toBe("\nNjeri");
    expect(pair(o.motherParents)).toEqual([undefined, "Njeri"]);
  });

  it("adds, renames and removes children and siblings by position", () => {
    let o = setSlot({}, "child:new", "Lucy");
    o = setSlot(o, "child:new", "Ben");
    o = setSlot(o, "child:new", "Amos");
    expect(lines(o.children)).toEqual(["Lucy", "Ben", "Amos"]);
    o = setSlot(o, "child:1", "Benjamin");
    expect(lines(o.children)).toEqual(["Lucy", "Benjamin", "Amos"]);
    o = removeSlot(o, "child:0");
    expect(lines(o.children)).toEqual(["Benjamin", "Amos"]);
    o = setSlot(o, "sibling:new", "Paul");
    expect(lines(o.siblings)).toEqual(["Paul"]);
    expect(getSlot(o, "child:1")).toBe("Amos");
  });

  it("ignores a tap on a position that does not exist", () => {
    const o = { children: "Lucy" };
    expect(setSlot(o, "child:5", "Ghost")).toBe(o);
    expect(setSlot(o, "child:-1", "Ghost")).toBe(o);
    expect(setSlot(o, "nonsense", "x")).toBe(o);
  });

  it("an empty name for a new entry adds nothing", () => {
    expect(lines(setSlot({ children: "Lucy" }, "child:new", "   ").children)).toEqual(["Lucy"]);
  });

  it("caps a list so a runaway page cannot grow it forever", () => {
    let o = {};
    for (let i = 0; i < 40; i++) o = setSlot(o, "child:new", `Kid ${i}`);
    expect(lines((o as { children: string }).children)).toHaveLength(20);
  });

  it("sets one spouse, and replaces or clears them", () => {
    let o = setSlot({}, "spouse", "Grace Kamau");
    expect(getSlot(o, "spouse")).toBe("Grace Kamau");
    o = setSlot(o, "spouse", "Grace Wanjiru");
    expect(lines(o.spouse)).toEqual(["Grace Wanjiru"]);
    expect(removeSlot(o, "spouse").spouse).toBe("");
  });

  it("names the person in the middle as a first name and a surname", () => {
    let o = setSlot({}, "focus", "Hesbon Okusimba Musungu");
    expect([o.first, o.surname]).toEqual(["Hesbon Okusimba", "Musungu"]);
    expect(getSlot(o, "focus")).toBe("Hesbon Okusimba Musungu");
    o = setSlot(o, "focus", "Ann");
    expect([o.first, o.surname]).toEqual(["Ann", ""]);
  });

  it("never lets a name inject a second entry", () => {
    const o = setSlot({}, "child:new", "Lucy\nEvil Person");
    expect(lines(o.children)).toEqual(["Lucy Evil Person"]);
    expect(cleanName("  A\t\tB\u0000C  ")).toBe("A B C");
    expect(cleanName("x".repeat(200))).toHaveLength(80);
  });

  it("does not change the answers it was given", () => {
    const before = { parents: "Peter", children: "Lucy" };
    const copy = { ...before };
    setSlot(before, "child:new", "Ben");
    setSlot(before, "father", "");
    expect(before).toEqual(copy);
  });
});

describe("what can be tapped", () => {
  it("offers parents, a spouse, a sibling and a child on an empty tree", () => {
    expect(emptySlots({})).toEqual(["father", "mother", "spouse", "sibling:new", "child:new"]);
  });

  it("offers grandparents only beside a parent who is there", () => {
    const o = setSlot({}, "father", "Peter");
    expect(emptySlots(o)).toEqual(expect.arrayContaining(["gp:ff", "gp:fm"]));
    expect(emptySlots(o)).not.toContain("gp:mf");
    expect(emptySlots(o)).not.toContain("father");
  });

  it("lists everyone on the tree, in a stable order", () => {
    let o = setSlot({}, "mother", "Mary");
    o = setSlot(o, "spouse", "Grace");
    o = setSlot(o, "child:new", "Lucy");
    o = setSlot(o, "child:new", "Ben");
    expect(filledSlots(o)).toEqual([
      { slot: "mother", name: "Mary" },
      { slot: "spouse", name: "Grace" },
      { slot: "child:0", name: "Lucy" },
      { slot: "child:1", name: "Ben" },
    ]);
  });

  it("labels slots in plain words", () => {
    expect(slotLabel("gp:mf")).toBe("Mother's father");
    expect(slotLabel("child:1")).toBe("Child 2");
    expect(slotLabel("child:new")).toBe("Add child");
    expect(slotLabel("sibling:new")).toBe("Add brother or sister");
  });
});

describe("what the browser is allowed to send", () => {
  const saved = { first: "Ann", surname: "Kamau", materialKey: "wood", sizeKey: "wall", matches: { "peter kamau": "abc" } };

  it("takes the tree's answers and leaves everything else as it was", () => {
    const out = sanitizeBuilderOptions({ first: "Anne", children: "Lucy\nBen" }, saved);
    expect(out.first).toBe("Anne");
    expect(out.surname).toBe("Kamau"); // not sent, so kept
    expect(lines(out.children)).toEqual(["Lucy", "Ben"]);
    expect(out.materialKey).toBe("wood");
    expect(out.sizeKey).toBe("wall");
    expect(out.matches).toEqual({ "peter kamau": "abc" });
  });

  it("never takes price, answers or ids from the browser", () => {
    const out = sanitizeBuilderOptions(
      { materialKey: "granite", sizeKey: "a1", matches: { x: "y" }, unitPriceKes: 1, id: "evil", __proto__: { admin: true }, constructor: "x" },
      saved,
    );
    expect(out.materialKey).toBe("wood");
    expect(out.sizeKey).toBe("wall");
    expect(out.matches).toEqual({ "peter kamau": "abc" });
    expect((out as Record<string, unknown>).unitPriceKes).toBeUndefined();
    expect((out as Record<string, unknown>).id).toBeUndefined();
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it("ignores values that are not text", () => {
    const out = sanitizeBuilderOptions({ first: { $gt: "" }, parents: ["a", "b"], children: 5, birth: null }, saved);
    expect(out.first).toBe("Ann");
    expect(out.parents).toBeUndefined();
    expect(out.children).toBeUndefined();
  });

  it("ignores a body that is not an object", () => {
    for (const bad of [null, undefined, "x", 5, ["a"]]) expect(sanitizeBuilderOptions(bad, saved)).toEqual(saved);
  });

  it("makes every single-line answer one tidy line of a sensible length", () => {
    const out = sanitizeBuilderOptions({ first: "  An\n\nne  ", surname: "K".repeat(500), epitaph: "e".repeat(900), birth: "1948\r\n2026" }, {});
    expect(out.first).toBe("An ne");
    expect(out.surname).toHaveLength(80);
    expect(out.epitaph).toHaveLength(300);
    expect(out.birth).toBe("1948 2026");
  });

  it("keeps a couple's places: a mother alone stays the mother", () => {
    const out = sanitizeBuilderOptions({ parents: "\nMary Wanjiku" }, {});
    expect(pair(out.parents)).toEqual([undefined, "Mary Wanjiku"]);
    const both = sanitizeBuilderOptions({ parents: "Peter \n Mary" }, {});
    expect(pair(both.parents)).toEqual(["Peter", "Mary"]);
  });

  it("caps long lists and drops empty entries", () => {
    const many = Array.from({ length: 60 }, (_, i) => `Kid ${i}`).join("\n");
    expect(lines(sanitizeBuilderOptions({ children: many }, {}).children)).toHaveLength(20);
    expect(lines(sanitizeBuilderOptions({ children: "a\n\n  \nb" }, {}).children)).toEqual(["a", "b"]);
  });

  it("accepts only a real relation", () => {
    expect(sanitizeBuilderOptions({ relation: "child" }, {}).relation).toBe("child");
    expect(sanitizeBuilderOptions({ relation: "president" }, { relation: "other" }).relation).toBe("other");
  });

  it("drops grandparents whose parent is no longer on the tree", () => {
    const out = sanitizeBuilderOptions({ parents: "\nMary", fatherParents: "Old\nOlder", motherParents: "Njeri" }, {});
    expect(out.fatherParents).toBe(""); // no father
    expect(out.motherParents).toBe("Njeri"); // mother is there
  });

  it("does not change what it was given", () => {
    const before = { first: "Ann" };
    sanitizeBuilderOptions({ first: "Bea" }, before);
    expect(before).toEqual({ first: "Ann" });
  });
});
