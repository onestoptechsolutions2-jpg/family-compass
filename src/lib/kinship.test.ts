import { describe, expect, it } from "vitest";

import { bloodRelationship, kinTermToward } from "./kinship";
import type { TreeGraph } from "@/lib/queries/graph";

/**
 * GF+GM are grandparents of dad and auntie (siblings). Dad+mum have Me.
 * Auntie has a child, Cousin — Me and Cousin are first cousins.
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
    gf: person("gf", "MALE"),
    gm: person("gm", "FEMALE"),
    dad: person("dad", "MALE"),
    auntie: person("auntie", "FEMALE"),
    mum: person("mum", "FEMALE"),
    me: person("me", "MALE"),
    cousin: person("cousin", "MALE"),
  };
  return {
    persons,
    up: { dad: ["gf", "gm"], auntie: ["gf", "gm"], me: ["dad", "mum"], cousin: ["auntie"] },
    down: { gf: ["dad", "auntie"], gm: ["dad", "auntie"], dad: ["me"], mum: ["me"], auntie: ["cousin"] },
    spouses: { dad: ["mum"], mum: ["dad"] },
    total: 7,
    truncated: false,
  };
}

describe("kinTermToward", () => {
  const g = graph();

  it("names a grandparent correctly", () => {
    const k = bloodRelationship(g, "gf", "me");
    expect(kinTermToward(k, "MALE")).toBe("grandfather");
  });

  it("names an aunt correctly", () => {
    const k = bloodRelationship(g, "auntie", "me");
    expect(kinTermToward(k, "FEMALE")).toBe("aunt");
  });

  it("names a first cousin as 'first cousin', not 'second cousin'", () => {
    const k = bloodRelationship(g, "cousin", "me");
    expect(kinTermToward(k, "MALE")).toBe("first cousin");
  });

  it("agrees with bloodRelationship's own label for the same pair", () => {
    const k = bloodRelationship(g, "cousin", "me");
    expect(k.label).toContain("first cousins");
  });
});
