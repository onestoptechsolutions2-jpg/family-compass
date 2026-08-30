/**
 * Builds a first-draft eulogy / life-sketch from the structured facts already
 * in the tree. Deliberately plain and gap-aware — it is a starting point for a
 * family editor, never the final text. No external model call.
 */
export type EulogyFacts = {
  name: string;
  given?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN" | null;
  bornDate?: string | null;
  bornPlace?: string | null;
  diedDate?: string | null;
  diedPlace?: string | null;
  ageYears?: number | null;
  clan?: string | null;
  subClan?: string | null;
  community?: string | null;
  parents?: string[];
  spouses?: string[];
  children?: string[];
  siblingsCount?: number | null;
  restingPlace?: string | null;
};

function pronoun(g: EulogyFacts["gender"]) {
  if (g === "MALE") return { subj: "He", poss: "his" };
  if (g === "FEMALE") return { subj: "She", poss: "her" };
  return { subj: "They", poss: "their" };
}

function list(items: string[] | undefined): string {
  const xs = (items ?? []).filter(Boolean);
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0]!;
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export function buildEulogyDraft(f: EulogyFacts): string {
  const p = pronoun(f.gender);
  const first = f.given || f.name.split(" ")[0] || f.name;
  const paras: string[] = [];

  // 1 — opening / birth
  {
    const bits: string[] = [];
    bits.push(`${f.name} was born`);
    if (f.bornDate) bits.push(`on ${f.bornDate}`);
    if (f.bornPlace) bits.push(`in ${f.bornPlace}`);
    let s = bits.join(" ") + ".";
    if (f.parents && f.parents.length) {
      s += ` ${p.subj} was born to ${list(f.parents)}.`;
    }
    if (f.clan) {
      s += ` ${p.subj} belonged to the ${f.clan}${f.subClan ? ` (${f.subClan})` : ""} clan`;
      s += f.community ? ` of the ${f.community} community.` : ".";
    }
    if (f.siblingsCount && f.siblingsCount > 0) {
      s += ` ${p.subj} grew up alongside ${f.siblingsCount} sibling${f.siblingsCount === 1 ? "" : "s"}.`;
    }
    paras.push(s);
  }

  // 2 — family of their own
  {
    const bits: string[] = [];
    if (f.spouses && f.spouses.length) {
      bits.push(`${first} was married to ${list(f.spouses)}.`);
    }
    if (f.children && f.children.length) {
      bits.push(
        `${p.subj} was blessed with ${f.children.length} child${f.children.length === 1 ? "" : "ren"}: ${list(f.children)}.`,
      );
    }
    if (bits.length) paras.push(bits.join(" "));
  }

  // 3 — a place for the family to write the life story
  paras.push(
    `[Add here: ${first}'s education, work, faith, character, and the moments the family remembers most.]`,
  );

  // 4 — passing
  {
    const bits: string[] = [];
    bits.push(`${f.name} passed away`);
    if (f.diedDate) bits.push(`on ${f.diedDate}`);
    if (f.diedPlace) bits.push(`at ${f.diedPlace}`);
    let s = bits.join(" ") + ".";
    if (f.ageYears && f.ageYears > 0) s += ` ${p.subj} was ${f.ageYears} years old.`;
    if (f.restingPlace) s += ` ${p.subj} is laid to rest at ${f.restingPlace}.`;
    s += ` ${p.subj} is survived and remembered by ${p.poss} family and community.`;
    paras.push(s);
  }

  return paras.join("\n\n");
}
