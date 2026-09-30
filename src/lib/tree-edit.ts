import { lines, pair, type DraftOptions } from "@/lib/order-shared";

/**
 * The rules for editing a family tree by tapping it. A tap names one slot
 * ("father", "gp:mf", "child:2") and this turns "set that slot to this name"
 * into the same plain answers the form uses, so checkout, matching and printing
 * need no change. Pure, so it is tested without a browser.
 *
 * Slots:  focus  father  mother  gp:ff gp:fm (father's parents)  gp:mf gp:mm (mother's parents)
 *         spouse  sibling:N  sibling:new  child:N  child:new
 */
export type SlotId = string;

const MAX_LIST = 20;

/** A name as one clean line: no newlines (they split entries), no runs of spaces. */
export function cleanName(raw: string, max = 80): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const GP: Record<string, { key: "fatherParents" | "motherParents"; at: 0 | 1 }> = {
  "gp:ff": { key: "fatherParents", at: 0 },
  "gp:fm": { key: "fatherParents", at: 1 },
  "gp:mf": { key: "motherParents", at: 0 },
  "gp:mm": { key: "motherParents", at: 1 },
};

export const SLOT_LABEL: Record<string, string> = {
  focus: "This person",
  father: "Father",
  mother: "Mother",
  "gp:ff": "Father's father",
  "gp:fm": "Father's mother",
  "gp:mf": "Mother's father",
  "gp:mm": "Mother's mother",
  spouse: "Spouse",
};

export function slotLabel(slot: SlotId): string {
  if (SLOT_LABEL[slot]) return SLOT_LABEL[slot]!;
  const [kind, which] = slot.split(":");
  const noun = kind === "sibling" ? "Brother or sister" : kind === "child" ? "Child" : slot;
  return which === "new" ? `Add ${noun.toLowerCase()}` : `${noun} ${Number(which) + 1}`;
}

/** Two positions, written back so each keeps its place ("\nMary" = a mother, no father). */
function writePair(text: string | undefined, at: 0 | 1, value: string): string {
  const p = pair(text);
  p[at] = value || undefined;
  if (!p[0] && !p[1]) return "";
  if (!p[1]) return p[0]!;
  return `${p[0] ?? ""}\n${p[1]}`;
}

/** The name in a slot, or "" if it is empty. */
export function getSlot(o: DraftOptions, slot: SlotId): string {
  if (slot === "focus") return [o.first, o.surname].filter(Boolean).join(" ");
  if (slot === "father") return pair(o.parents)[0] ?? "";
  if (slot === "mother") return pair(o.parents)[1] ?? "";
  if (GP[slot]) return pair(o[GP[slot]!.key])[GP[slot]!.at] ?? "";
  if (slot === "spouse") return lines(o.spouse)[0] ?? "";
  const [kind, i] = slot.split(":");
  if ((kind === "sibling" || kind === "child") && i !== "new") {
    return lines(kind === "sibling" ? o.siblings : o.children)[Number(i)] ?? "";
  }
  return "";
}

/** Put a name in a slot; an empty name empties it. Never mutates the input. */
export function setSlot(o: DraftOptions, slot: SlotId, rawName: string): DraftOptions {
  const name = cleanName(rawName);
  const next: DraftOptions = { ...o };

  if (slot === "focus") {
    const parts = name.split(" ").filter(Boolean);
    next.surname = parts.length > 1 ? parts[parts.length - 1] : "";
    next.first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");
    return next;
  }
  if (slot === "father" || slot === "mother") {
    next.parents = writePair(o.parents, slot === "father" ? 0 : 1, name);
    // taking a parent away takes their own parents off the tree with them
    if (!name) next[slot === "father" ? "fatherParents" : "motherParents"] = "";
    return next;
  }
  if (GP[slot]) {
    const { key, at } = GP[slot]!;
    // a grandparent hangs off a parent: there must be one to hang off
    const parent = slot.startsWith("gp:f") ? pair(o.parents)[0] : pair(o.parents)[1];
    if (name && !parent) return o;
    next[key] = writePair(o[key], at, name);
    return next;
  }
  if (slot === "spouse") {
    next.spouse = name;
    return next;
  }
  const [kind, i] = slot.split(":");
  if (kind === "sibling" || kind === "child") {
    const key = kind === "sibling" ? "siblings" : "children";
    const list = lines(o[key]);
    if (i === "new") {
      if (name && list.length < MAX_LIST) list.push(name);
    } else {
      const at = Number(i);
      if (!Number.isInteger(at) || at < 0 || at >= list.length) return o;
      if (name) list[at] = name;
      else list.splice(at, 1);
    }
    next[key] = list.join("\n");
    return next;
  }
  return o;
}

export const removeSlot = (o: DraftOptions, slot: SlotId) => setSlot(o, slot, "");

/** Which slots can be tapped to add someone, given who is already on the tree. */
export function emptySlots(o: DraftOptions): SlotId[] {
  const out: SlotId[] = [];
  if (!getSlot(o, "father")) out.push("father");
  if (!getSlot(o, "mother")) out.push("mother");
  if (getSlot(o, "father")) for (const s of ["gp:ff", "gp:fm"]) if (!getSlot(o, s)) out.push(s);
  if (getSlot(o, "mother")) for (const s of ["gp:mf", "gp:mm"]) if (!getSlot(o, s)) out.push(s);
  if (!getSlot(o, "spouse")) out.push("spouse");
  out.push("sibling:new", "child:new");
  return out;
}

/** Everyone who is on the tree now, as slots with names. */
export function filledSlots(o: DraftOptions): { slot: SlotId; name: string }[] {
  const out: { slot: SlotId; name: string }[] = [];
  const add = (slot: SlotId) => {
    const name = getSlot(o, slot);
    if (name) out.push({ slot, name });
  };
  ["father", "mother", "gp:ff", "gp:fm", "gp:mf", "gp:mm", "spouse"].forEach(add);
  lines(o.siblings).forEach((_, i) => add(`sibling:${i}`));
  lines(o.children).forEach((_, i) => add(`child:${i}`));
  return out;
}

/** What the builder may send. Anything else (prices, answers about matches, ids) is never taken from the browser. */
const SINGLE_LINE: Record<string, number> = { first: 80, surname: 80, spouse: 80, birth: 60, death: 60, place: 120, title: 120, epitaph: 300 };
const PAIRS = ["parents", "fatherParents", "motherParents"] as const;
const LISTS = ["children", "siblings"] as const;
const RELATIONS = ["child", "spouse", "sibling", "other"] as const;

/**
 * Clean whatever the builder sent and lay it over the answers already saved.
 * Only the tree's own answers are read, every value is forced to tidy one-line
 * text of a sensible length, lists are capped, and a couple keeps each person
 * in their place. The material, size and everything else already on the draft
 * are left exactly as they were.
 */
export function sanitizeBuilderOptions(raw: unknown, previous: DraftOptions): DraftOptions {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const next: DraftOptions = { ...previous };
  const str = (k: string) => (Object.prototype.hasOwnProperty.call(src, k) && typeof src[k] === "string" ? (src[k] as string) : null);

  for (const [key, max] of Object.entries(SINGLE_LINE)) {
    const v = str(key);
    if (v !== null) (next as Record<string, string>)[key] = cleanName(v, max);
  }
  for (const key of PAIRS) {
    const v = str(key);
    if (v === null) continue;
    const [a, b] = pair(v).map((n) => (n ? cleanName(n) : ""));
    next[key] = !a && !b ? "" : !b ? a! : `${a ?? ""}\n${b}`;
  }
  for (const key of LISTS) {
    const v = str(key);
    if (v !== null) next[key] = lines(v).map((n) => cleanName(n)).filter(Boolean).slice(0, MAX_LIST).join("\n");
  }
  const rel = str("relation");
  if (rel !== null && (RELATIONS as readonly string[]).includes(rel)) next.relation = rel as DraftOptions["relation"];

  // grandparents only hang off a parent who is on the tree
  if (!pair(next.parents)[0] && next.fatherParents) next.fatherParents = "";
  if (!pair(next.parents)[1] && next.motherParents) next.motherParents = "";
  return next;
}
