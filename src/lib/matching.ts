import { db } from "@/lib/db";
import { lines, normaliseName, splitName, type DraftOptions } from "@/lib/order-shared";
import { parseBirthdays } from "@/lib/print-layouts";

/** A person already in the customer's family who might be the one they just typed. */
export type Candidate = { id: string; name: string; born: string | null; you: boolean };
export type MatchQuestion = { itemId: string; key: string; typed: string; role: string; candidates: Candidate[] };

type ItemLike = { id: string; options: unknown; product: { layout: string; pathway: string } };

/** Every name a customer typed into one item, with what they are to the piece. */
export function typedNames(o: DraftOptions, layout: string, pathway: string): { typed: string; role: string }[] {
  const out: { typed: string; role: string }[] = [];
  const add = (typed: string | undefined, role: string) => {
    if (typed?.trim()) out.push({ typed: typed.trim(), role });
  };
  // A memorial or a wedding is about someone the customer names; every other Living
  // piece is about the customer's own person, who is never asked about.
  if (pathway === "REMEMBERED" || layout === "wedding") add([o.first, o.surname].filter(Boolean).join(" "), "the person this is for");
  for (const n of lines(o.parents)) add(n, "a parent");
  for (const n of lines(o.fatherParents)) add(n, "a grandparent");
  for (const n of lines(o.motherParents)) add(n, "a grandparent");
  for (const n of lines(o.spouseParents)) add(n, "a parent of their partner");
  for (const n of lines(o.spouse)) add(n, "a spouse");
  for (const n of lines(o.children)) add(n, "a child");
  for (const n of lines(o.siblings)) add(n, "a brother or sister");
  if (layout === "calendar") for (const e of parseBirthdays(o.birthdays).entries) if (e.year) add(e.name, "on the calendar");
  return out;
}

/**
 * For a customer who already has a family, find the typed names that look like
 * someone already in it, so we can ask instead of quietly making a duplicate.
 * A name matches when the full name is the same, or the first name and surname
 * are (ignoring middle names). Nothing is asked of a first-time customer.
 */
export async function findMatchQuestions(userId: string, items: ItemLike[]): Promise<MatchQuestion[]> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { primaryTreeId: true, personId: true } });
  if (!user?.primaryTreeId) return [];

  const people = await db.person.findMany({
    where: { treeId: user.primaryTreeId },
    select: {
      id: true,
      names: { where: { preferred: true }, take: 1, select: { first: true, surname: true } },
      eventRefs: { where: { role: "PRIMARY", event: { type: "Birth" } }, take: 1, select: { event: { select: { dateYear: true } } } },
    },
  });
  const index = people
    .map((p) => {
      const n = p.names[0];
      const first = (n?.first ?? "").trim();
      const surname = (n?.surname ?? "").trim();
      if (!first && !surname) return null;
      return {
        id: p.id,
        label: [first, surname].filter(Boolean).join(" "),
        full: normaliseName(`${first} ${surname}`),
        short: normaliseName(`${first.split(/\s+/)[0] ?? ""} ${surname}`),
        born: p.eventRefs[0]?.event.dateYear ? String(p.eventRefs[0].event.dateYear) : null,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const questions: MatchQuestion[] = [];
  for (const item of items) {
    const o = (item.options ?? {}) as DraftOptions;
    const seen = new Set<string>();
    for (const { typed, role } of typedNames(o, item.product.layout, item.product.pathway)) {
      const key = normaliseName(typed);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const { first, surname } = splitName(typed);
      const short = normaliseName(`${first.split(/\s+/)[0] ?? ""} ${surname}`);
      const candidates = index
        .filter((p) => p.full === key || (short.length > 2 && p.short === short))
        .slice(0, 4)
        .map((p) => ({ id: p.id, name: p.label, born: p.born, you: p.id === user.personId }));
      if (candidates.length) questions.push({ itemId: item.id, key, typed, role, candidates });
    }
  }
  return questions;
}

/** The customer's answers, as posted: `match:<itemId>:<key>` = a person id, or "new". */
export function parseAnswers(form: FormData): Map<string, Record<string, string>> {
  const byItem = new Map<string, Record<string, string>>();
  for (const [name, value] of form.entries()) {
    if (!name.startsWith("match:") || typeof value !== "string") continue;
    const rest = name.slice("match:".length);
    const i = rest.indexOf(":");
    if (i < 1) continue;
    const itemId = rest.slice(0, i);
    const key = rest.slice(i + 1);
    byItem.set(itemId, { ...(byItem.get(itemId) ?? {}), [key]: value.slice(0, 60) });
  }
  return byItem;
}
