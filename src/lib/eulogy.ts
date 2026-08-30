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
  notes?: BioNotes | null;
};

/** Free-text answers gathered by the biography wizard. */
export type BioNotes = {
  earlyLife?: string;
  education?: string;
  career?: string;
  faith?: string;
  character?: string;
  interests?: string;
  achievements?: string;
  illness?: string;
  finalDays?: string;
  lastWords?: string;
  favouriteScripture?: string;
  favouriteHymn?: string;
};

export const BIO_FIELDS: { key: keyof BioNotes; label: string; hint: string; rows: number }[] = [
  { key: "earlyLife", label: "Early life & childhood", hint: "Where they grew up, home, family life", rows: 3 },
  { key: "education", label: "Education", hint: "Schools, college, courses, qualifications", rows: 3 },
  { key: "career", label: "Work & career", hint: "Jobs, employers, business, service, retirement", rows: 3 },
  { key: "faith", label: "Faith & church", hint: "Denomination, church, baptism, ministry, role", rows: 2 },
  { key: "character", label: "Character & values", hint: "How the family will remember them", rows: 3 },
  { key: "interests", label: "Interests & hobbies", hint: "Farming, sport, music, cooking, travel…", rows: 2 },
  { key: "achievements", label: "Achievements & honours", hint: "Awards, milestones, contributions to the community", rows: 2 },
  { key: "illness", label: "Illness", hint: "Nature of the illness, care received (optional)", rows: 2 },
  { key: "finalDays", label: "Final days", hint: "The last weeks, who was present", rows: 2 },
  { key: "lastWords", label: "Last words / final wishes", hint: "Anything they said or asked for", rows: 2 },
  { key: "favouriteScripture", label: "Favourite scripture / reading", hint: "e.g. Psalm 23", rows: 1 },
  { key: "favouriteHymn", label: "Favourite hymn / song", hint: "For the programme and the book", rows: 1 },
];

function pronoun(g: EulogyFacts["gender"]) {
  if (g === "MALE") return { subj: "He", poss: "his", obj: "him" };
  if (g === "FEMALE") return { subj: "She", poss: "her", obj: "her" };
  return { subj: "They", poss: "their", obj: "them" };
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

  // 3 — the life story, from the biography wizard (or a prompt if not filled)
  const n = f.notes ?? {};
  const lead = (s?: string) => (s && s.trim() ? s.trim() : "");
  const storyParas: string[] = [];

  const el = lead(n.earlyLife);
  const ed = lead(n.education);
  if (el || ed) {
    storyParas.push(
      [el && `${el}`, ed && `${p.subj} was educated at ${ed.replace(/^(at|in)\s+/i, "")}.`]
        .filter(Boolean)
        .join(" "),
    );
  }
  const ca = lead(n.career);
  if (ca) storyParas.push(`In ${p.poss} working life, ${lowerFirst(ca)}`.replace(/\.?$/, "."));
  const fa = lead(n.faith);
  if (fa) storyParas.push(`${p.subj} was a person of faith. ${capitalise(fa)}`.replace(/\.?$/, "."));
  const ch = lead(n.character);
  const inx = lead(n.interests);
  if (ch || inx) {
    storyParas.push(
      [
        ch && `Those who knew ${first} remember ${p.obj} as ${lowerFirst(ch)}`.replace(/\.?$/, "."),
        inx && `${p.subj} loved ${lowerFirst(inx)}`.replace(/\.?$/, "."),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  const ac = lead(n.achievements);
  if (ac) storyParas.push(`Among ${p.poss} achievements, ${lowerFirst(ac)}`.replace(/\.?$/, "."));

  if (storyParas.length) paras.push(...storyParas);
  else
    paras.push(
      `[Add here: ${first}'s education, work, faith, character, and the moments the family remembers most — the Biography wizard collects these.]`,
    );

  // 4 — illness & final days
  {
    const il = lead(n.illness);
    const fd = lead(n.finalDays);
    const lw = lead(n.lastWords);
    const bits: string[] = [];
    if (il) bits.push(capitalise(il).replace(/\.?$/, "."));
    if (fd) bits.push(capitalise(fd).replace(/\.?$/, "."));
    if (lw) bits.push(`In ${p.poss} last words, ${first} said: “${lw.replace(/^["“]|["”]$/g, "")}”.`);
    if (bits.length) paras.push(bits.join(" "));
  }

  // 5 — passing
  {
    const bits: string[] = [];
    bits.push(`${f.name} passed away`);
    if (f.diedDate) bits.push(`on ${f.diedDate}`);
    if (f.diedPlace) bits.push(`at ${f.diedPlace}`);
    let s = bits.join(" ") + ".";
    if (f.ageYears && f.ageYears > 0) s += ` ${p.subj} was ${f.ageYears} years old.`;
    if (f.restingPlace) s += ` ${p.subj} is laid to rest at ${f.restingPlace}.`;
    const fav = lead(n.favouriteScripture);
    if (fav) s += ` ${p.poss.charAt(0).toUpperCase() + p.poss.slice(1)} favourite scripture was ${fav}.`;
    s += ` ${p.subj} is survived and remembered by ${p.poss} family and community.`;
    paras.push(s);
  }

  return paras.join("\n\n");
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
