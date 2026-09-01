import { describe, expect, it } from "vitest";
import { ClanInheritance, Gender } from "@prisma/client";

import { lineageParent } from "./lineage";

const dad = { id: "dad", gender: Gender.MALE };
const mum = { id: "mum", gender: Gender.FEMALE };
const u1 = { id: "u1", gender: Gender.UNKNOWN };
const u2 = { id: "u2", gender: Gender.UNKNOWN };

describe("lineageParent", () => {
  it("patrilineal picks the father regardless of slot order", () => {
    expect(lineageParent(dad, mum, ClanInheritance.PATRILINEAL)).toBe("dad");
    expect(lineageParent(mum, dad, ClanInheritance.PATRILINEAL)).toBe("dad");
  });

  it("matrilineal picks the mother regardless of slot order", () => {
    expect(lineageParent(dad, mum, ClanInheritance.MATRILINEAL)).toBe("mum");
    expect(lineageParent(mum, dad, ClanInheritance.MATRILINEAL)).toBe("mum");
  });

  it("NONE never inherits", () => {
    expect(lineageParent(dad, mum, ClanInheritance.NONE)).toBeNull();
  });

  it("falls back to the conventional slot when genders are unknown", () => {
    expect(lineageParent(u1, u2, ClanInheritance.PATRILINEAL)).toBe("u1");
    expect(lineageParent(u1, u2, ClanInheritance.MATRILINEAL)).toBe("u2");
  });

  it("uses whichever partner exists when only one is set", () => {
    expect(lineageParent(null, mum, ClanInheritance.PATRILINEAL)).toBe("mum");
    expect(lineageParent(dad, null, ClanInheritance.MATRILINEAL)).toBe("dad");
    expect(lineageParent(null, null, ClanInheritance.PATRILINEAL)).toBeNull();
  });
});
