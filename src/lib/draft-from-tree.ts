import type { GraphPerson, TreeGraph } from "@/lib/queries/graph";
import { normaliseName, type DraftOptions } from "@/lib/order-shared";

function orderedParents(ids: string[], graph: TreeGraph): [string | undefined, string | undefined] {
  const parents = ids.map((id) => graph.persons[id]).filter((person): person is GraphPerson => Boolean(person));
  const male = parents.find((person) => person.gender === "MALE");
  const female = parents.find((person) => person.gender === "FEMALE");
  const remaining = parents.filter((person) => person.id !== male?.id && person.id !== female?.id);
  const father = male ?? remaining.shift();
  const mother = female ?? remaining.shift();
  return [father?.id, mother?.id];
}

function parentPair(ids: string[], graph: TreeGraph): [string, string] {
  return orderedParents(ids, graph).map((id) => (id ? graph.persons[id]?.name ?? "" : "")) as [string, string];
}

export function draftOptionsFromTree(
  graph: TreeGraph,
  focusPersonId: string,
  customerPersonId: string | null,
): DraftOptions | null {
  const focus = graph.persons[focusPersonId];
  if (!focus) return null;

  const parentIds = graph.up[focusPersonId] ?? [];
  const [fatherId, motherId] = orderedParents(parentIds, graph);
  const spouseIds = graph.spouses[focusPersonId] ?? [];
  const childIds = graph.down[focusPersonId] ?? [];
  const siblingIds = [...new Set(parentIds.flatMap((parentId) => graph.down[parentId] ?? []))]
    .filter((id) => id !== focusPersonId);
  const names = (ids: string[]) => ids.map((id) => graph.persons[id]?.name).filter(Boolean) as string[];
  const paternalGrandparents = parentPair(fatherId ? graph.up[fatherId] ?? [] : [], graph);
  const maternalGrandparents = parentPair(motherId ? graph.up[motherId] ?? [] : [], graph);
  const firstSpouse = spouseIds[0];
  const [spouseFather, spouseMother] = parentPair(firstSpouse ? graph.up[firstSpouse] ?? [] : [], graph);
  const usedIds = new Set([
    focusPersonId,
    ...parentIds,
    ...(fatherId ? graph.up[fatherId] ?? [] : []),
    ...(motherId ? graph.up[motherId] ?? [] : []),
    ...spouseIds,
    ...(firstSpouse ? graph.up[firstSpouse] ?? [] : []),
    ...childIds,
    ...siblingIds,
  ]);

  const matchIds = new Map<string, string | null>();
  for (const id of usedIds) {
    const person = graph.persons[id];
    if (!person?.name.trim()) continue;
    const key = normaliseName(person.name);
    if (!matchIds.has(key)) matchIds.set(key, id);
    else if (matchIds.get(key) !== id) matchIds.set(key, null);
  }
  const matches = Object.fromEntries([...matchIds].filter((entry): entry is [string, string] => !!entry[1]));

  const customerIsChild = !!customerPersonId && (graph.up[customerPersonId] ?? []).includes(focusPersonId);
  const customerIsSpouse = !!customerPersonId && spouseIds.includes(customerPersonId);
  const customerIsSibling = !!customerPersonId && siblingIds.includes(customerPersonId);

  return {
    first: focus.given,
    surname: focus.surname,
    birth: focus.birth || undefined,
    death: focus.death || undefined,
    parents: parentPair(parentIds, graph).join("\n"),
    fatherParents: paternalGrandparents.some(Boolean) ? paternalGrandparents.join("\n") : undefined,
    motherParents: maternalGrandparents.some(Boolean) ? maternalGrandparents.join("\n") : undefined,
    spouse: names(spouseIds).join("\n"),
    spouseParents: [spouseFather, spouseMother].filter(Boolean).join("\n"),
    children: names(childIds).join("\n"),
    siblings: names(siblingIds).join("\n"),
    birthdays: [...usedIds]
      .map((id) => graph.persons[id])
      .filter((person) => person?.birth)
      .map((person) => `${person!.name}, ${person!.birth}`)
      .join("\n"),
    ...(Object.keys(matches).length ? { matches } : {}),
    ...(customerIsChild ? { relation: "child" as const } : customerIsSpouse ? { relation: "spouse" as const } : customerIsSibling ? { relation: "sibling" as const } : undefined),
  };
}