import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { authenticateApi, requireApiTree } from "@/lib/api/auth";
import { apiOk, apiError, apiPreflight, isResponse } from "@/lib/api/respond";
import { API_PERSON_SELECT, serializePerson } from "@/lib/api/serialize";
import { displayName } from "@/lib/person";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiPreflight();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ treeId: string; personId: string }> },
) {
  const ctx = await authenticateApi(req, "read");
  if (isResponse(ctx)) return ctx;
  const { treeId, personId } = await params;
  const tree = await requireApiTree(ctx, treeId);
  if (isResponse(tree)) return tree;

  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      ...API_PERSON_SELECT,
      childRefs: {
        select: {
          family: {
            select: {
              id: true,
              partner1: { select: { id: true, names: { select: { first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true, preferred: true, type: true, order: true } } } },
              partner2: { select: { id: true, names: { select: { first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true, preferred: true, type: true, order: true } } } },
            },
          },
        },
      },
      familiesAsPartner1: { select: { id: true, partner2Id: true, childRefs: { select: { personId: true } } } },
      familiesAsPartner2: { select: { id: true, partner1Id: true, childRefs: { select: { personId: true } } } },
    },
  });
  if (!person) return apiError(404, "not_found", "Person not found.");

  const parents = person.childRefs.flatMap((c) =>
    [c.family.partner1, c.family.partner2].filter(Boolean).map((p) => ({ id: p!.id, name: displayName(p!.names) })),
  );
  const families = [
    ...person.familiesAsPartner1.map((f) => ({ id: f.id, partnerId: f.partner2Id, childIds: f.childRefs.map((c) => c.personId) })),
    ...person.familiesAsPartner2.map((f) => ({ id: f.id, partnerId: f.partner1Id, childIds: f.childRefs.map((c) => c.personId) })),
  ];

  return apiOk({ ...serializePerson(person), parents, families });
}
