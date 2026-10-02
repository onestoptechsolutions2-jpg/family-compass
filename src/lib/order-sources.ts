import "server-only";

import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";
import { getTreeGraph } from "@/lib/queries/graph";
import { draftOptionsFromTree } from "@/lib/draft-from-tree";

export type SavedOrderPerson = { id: string; name: string };
export type SavedOrderSources = {
  treeId: string;
  customerPersonId: string | null;
  people: SavedOrderPerson[];
};

/** Only the signed-in client's primary tree is offered as a reusable source. */
export async function savedOrderSources(userId: string): Promise<SavedOrderSources | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { primaryTreeId: true, personId: true },
  });
  if (!user?.primaryTreeId) return null;

  const people = await db.person.findMany({
    where: { treeId: user.primaryTreeId },
    select: { id: true, names: { where: { preferred: true }, take: 1, select: NAME_SELECT } },
    orderBy: { id: "asc" },
    take: 500,
  });
  const sources = people
    .map((person) => ({ id: person.id, name: displayName(person.names) }))
    .filter((person) => person.name.trim());
  if (user.personId && !sources.some((person) => person.id === user.personId)) {
    const customer = await db.person.findFirst({
      where: { id: user.personId, treeId: user.primaryTreeId },
      select: { id: true, names: { where: { preferred: true }, take: 1, select: NAME_SELECT } },
    });
    if (customer) sources.unshift({ id: customer.id, name: displayName(customer.names) });
  }

  return { treeId: user.primaryTreeId, customerPersonId: user.personId, people: sources };
}

/** Build a new order draft only from a person in the client's primary tree. */
export async function savedDraftForPerson(userId: string, personId: string, allowOtherPeople = true) {
  const sources = await savedOrderSources(userId);
  if (!sources || !sources.people.some((person) => person.id === personId)) return null;
  if (!allowOtherPeople && sources.customerPersonId !== personId) return null;
  const graph = await getTreeGraph(sources.treeId, personId);
  const options = draftOptionsFromTree(graph, personId, sources.customerPersonId);
  return options ? { options, treeId: sources.treeId, personId } : null;
}