import { Prisma } from "@prisma/client";

import { displayName, NAME_SELECT } from "@/lib/person";
import { formatDate } from "@/lib/date";

export const API_PERSON_SELECT = {
  id: true,
  gender: true,
  living: true,
  privacy: true,
  grampsId: true,
  clanId: true,
  subClan: true,
  createdAt: true,
  updatedAt: true,
  names: { select: NAME_SELECT },
  eventRefs: {
    where: { event: { is: { type: { in: ["Birth", "Death"] } } } },
    select: {
      event: {
        select: {
          type: true,
          dateYear: true,
          dateMonth: true,
          dateDay: true,
          dateText: true,
          place: { select: { title: true } },
        },
      },
    },
  },
} satisfies Prisma.PersonSelect;

export type ApiPersonRow = Prisma.PersonGetPayload<{ select: typeof API_PERSON_SELECT }>;

export function serializePerson(p: ApiPersonRow) {
  const birth = p.eventRefs.find((r) => r.event.type === "Birth")?.event ?? null;
  const death = p.eventRefs.find((r) => r.event.type === "Death")?.event ?? null;
  return {
    id: p.id,
    name: p.privacy === "PRIVATE" ? "Private" : displayName(p.names),
    gender: p.gender,
    living: p.living,
    privacy: p.privacy,
    grampsId: p.grampsId,
    clanId: p.clanId,
    subClan: p.subClan,
    birth: birth
      ? { date: formatDate(birth), year: birth.dateYear, place: birth.place?.title ?? null }
      : null,
    death: death
      ? { date: formatDate(death), year: death.dateYear, place: death.place?.title ?? null }
      : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
