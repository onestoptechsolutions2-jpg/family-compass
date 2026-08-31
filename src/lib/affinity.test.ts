import { describe, expect, it } from "vitest";

import { affinalRelationship } from "./affinity";
import type { TreeGraph } from "@/lib/queries/graph";

/**
 * F+M are parents of the brothers mA and mB.
 * mA marries wX; mB marries wY. mA+wX have a child C.
 */
function graph(): TreeGraph {
  const person = (id: string, gender: "MALE" | "FEMALE") => ({
    id,
    name: id,
    given: id,
    surname: "",
    gender,
    living: true,
    deceased: false,
    birth: "",
    death: "",
    birthYear: null,
    deathYear: null,
  });
  const persons = {
    F: person("F", "MALE"),
    M: person("M", "FEMALE"),
    mA: person("mA", "MALE"),
    mB: person("mB", "MALE"),
    wX: person("wX", "FEMALE"),
    wY: person("wY", "FEMALE"),
    C: person("C", "FEMALE"),
  };
  return {
    persons,
    up: { mA: ["F", "M"], mB: ["F", "M"], C: ["mA", "wX"] },
    down: { F: ["mA", "mB"], M: ["mA", "mB"], mA: ["C"], wX: ["C"] },
    spouses: { mA: ["wX"], wX: ["mA"], mB: ["wY"], wY: ["mB"] },
    total: 7,
    truncated: false,
  };
}

describe("affinalRelationship", () => {
  const g = graph();

  it("names two women married to brothers as sisters-in-law (shemeji / wifi)", () => {
    const r = affinalRelationship(g, "wX", "wY");
    expect(r.found).toBe(true);
    expect(r.aToB.en.toLowerCase()).toContain("sister-in-law");
    expect(r.aToB.sw).toContain("wifi");
  });

  it("names a spouse's parent as a parent-in-law (mkwe)", () => {
    const r = affinalRelationship(g, "wX", "F");
    expect(r.found).toBe(true);
    expect(r.aToB.en).toBe("father-in-law");
    expect(r.aToB.sw).toContain("mkwe");
    expect(r.bToA.en).toBe("child-in-law");
  });

  it("names a sibling's spouse as a sibling-in-law (shemeji), gendered by the other person", () => {
    const r = affinalRelationship(g, "mA", "wY"); // wY is a woman
    expect(r.found).toBe(true);
    expect(r.aToB.en.toLowerCase()).toContain("sister-in-law");
    expect(r.aToB.sw).toContain("shemeji");
    expect(r.bToA.en).toBe("sibling-in-law");
  });

  it("names a parent's brother's wife as an aunt by marriage (mama …)", () => {
    const r = affinalRelationship(g, "C", "wY");
    expect(r.found).toBe(true);
    expect(r.aToB.en).toContain("aunt");
    expect(r.aToB.sw).toContain("mama");
    expect(r.bToA.sw).toBe("mpwa");
  });

  it("returns not-found for a plain blood relative", () => {
    const r = affinalRelationship(g, "mA", "mB");
    expect(r.found).toBe(false);
  });
});
