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

  it("names a child's spouse's in-laws by the PARENT's own gender, not the child's spouse's", () => {
    // Reverse direction of the "spouse's parent" case above: from the
    // parent's side, looking at their child's spouse. Both F (father) and M
    // (mother) are wX's parents-in-law — bToA must follow F/M's own gender,
    // not wX's (constant FEMALE), or M would wrongly come out "father-in-law"
    // too. This is the exact bug this regression test was added to catch.
    const fromFather = affinalRelationship(g, "F", "wX");
    expect(fromFather.found).toBe(true);
    expect(fromFather.aToB.en).toBe("daughter-in-law"); // what F calls wX
    expect(fromFather.bToA.en).toBe("father-in-law"); // what wX calls F

    const fromMother = affinalRelationship(g, "M", "wX");
    expect(fromMother.found).toBe(true);
    expect(fromMother.aToB.en).toBe("daughter-in-law"); // what M calls wX
    expect(fromMother.bToA.en).toBe("mother-in-law"); // what wX calls M — NOT "father-in-law"
  });

  it("names a sibling's spouse as a sibling-in-law (shemeji), gendered by each person's own gender", () => {
    const r = affinalRelationship(g, "mA", "wY"); // mA is a man, wY is a woman
    expect(r.found).toBe(true);
    // aToB: what mA calls wY (his brother's wife) — gendered by wY (FEMALE)
    expect(r.aToB.en.toLowerCase()).toContain("sister-in-law");
    expect(r.aToB.sw).toContain("shemeji");
    // bToA: what wY calls mA (her husband's brother) — gendered by mA (MALE),
    // not by wY. A same-gender-for-both-directions reading would wrongly
    // give "sister-in-law" here too.
    expect(r.bToA.en.toLowerCase()).toContain("brother-in-law");
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
