import { describe, expect, it } from "vitest";

import type { TreeGraph } from "@/lib/queries/graph";
import { draftOptionsFromTree } from "./draft-from-tree";

const graph: TreeGraph = {
  persons: {
    customer: { id: "customer", name: "Amina Kamau", given: "Amina", surname: "Kamau", gender: "FEMALE", living: true, deceased: false, birth: "1988", death: "", birthYear: 1988, deathYear: null },
    focus: { id: "focus", name: "Peter Kamau", given: "Peter", surname: "Kamau", gender: "MALE", living: false, deceased: true, birth: "1950", death: "2020", birthYear: 1950, deathYear: 2020 },
    father: { id: "father", name: "James Kamau", given: "James", surname: "Kamau", gender: "MALE", living: false, deceased: true, birth: "1920", death: "1990", birthYear: 1920, deathYear: 1990 },
    mother: { id: "mother", name: "Grace Wanjiku", given: "Grace", surname: "Wanjiku", gender: "FEMALE", living: false, deceased: true, birth: "1924", death: "2000", birthYear: 1924, deathYear: 2000 },
    grandfather: { id: "grandfather", name: "John Kamau", given: "John", surname: "Kamau", gender: "MALE", living: false, deceased: true, birth: "1890", death: "1960", birthYear: 1890, deathYear: 1960 },
    grandmother: { id: "grandmother", name: "Mary Kamau", given: "Mary", surname: "Kamau", gender: "FEMALE", living: false, deceased: true, birth: "1892", death: "1965", birthYear: 1892, deathYear: 1965 },
    spouse: { id: "spouse", name: "Ruth Achieng", given: "Ruth", surname: "Achieng", gender: "FEMALE", living: true, deceased: false, birth: "", death: "", birthYear: null, deathYear: null },
    child: { id: "child", name: "Tom Kamau", given: "Tom", surname: "Kamau", gender: "MALE", living: true, deceased: false, birth: "2010", death: "", birthYear: 2010, deathYear: null },
    sibling: { id: "sibling", name: "Jane Kamau", given: "Jane", surname: "Kamau", gender: "FEMALE", living: true, deceased: false, birth: "1985", death: "", birthYear: 1985, deathYear: null },
  },
  up: { focus: ["father", "mother"], father: ["grandfather", "grandmother"], customer: ["focus"], child: ["focus"] },
  down: { father: ["focus", "sibling"], mother: ["focus", "sibling"], focus: ["customer", "child"] },
  spouses: { focus: ["spouse"] },
  total: 9,
  truncated: false,
};

describe("draft options from saved family data", () => {
  it("prefills relatives in the expected parent order and retains person links", () => {
    const options = draftOptionsFromTree(graph, "focus", "customer");
    expect(options?.parents).toBe("James Kamau\nGrace Wanjiku");
    expect(options?.fatherParents).toBe("John Kamau\nMary Kamau");
    expect(options?.spouse).toBe("Ruth Achieng");
    expect(options?.children).toBe("Amina Kamau\nTom Kamau");
    expect(options?.siblings).toBe("Jane Kamau");
    expect(options?.matches?.["peter kamau"]).toBe("focus");
    expect(options?.matches?.["jane kamau"]).toBe("sibling");
    expect(options?.relation).toBe("child");
  });

  it("returns null when the selected person is not in the saved graph", () => {
    expect(draftOptionsFromTree(graph, "missing", "customer")).toBeNull();
  });
});