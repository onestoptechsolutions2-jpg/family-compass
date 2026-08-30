import { db } from "@/lib/db";
import { displayName } from "@/lib/person";

const NAME_SELECT = {
  first: true, surname: true, surnamePrefix: true, suffix: true,
  nick: true, title: true, preferred: true, type: true, order: true,
} as const;

export type AnniversaryKind = "birthday" | "death" | "wedding";

export type Anniversary = {
  eventId: string;
  treeId: string;
  kind: AnniversaryKind;
  /** the date it lands on this cycle (UTC midnight) */
  date: Date;
  /** days from today (0 = today) */
  inDays: number;
  /** whole years, when the original year is known */
  years: number | null;
  /** person the reminder is about (couple → partner1) */
  personId: string | null;
  familyId: string | null;
  title: string;
  detail: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dayLabel(m: number, d: number): string {
  return `${d} ${MONTHS[m - 1] ?? ""}`.trim();
}

/**
 * All birthday / death / wedding anniversaries falling within the next
 * `leadDays` days (inclusive of today). Pass a treeId to scope, or null to
 * sweep every tree that has reminders enabled (the worker path).
 */
export async function collectAnniversaries(
  treeId: string | null,
  leadDays: number,
): Promise<Anniversary[]> {
  const today = new Date();
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  // map "MM-DD" -> { date, inDays }
  const window = new Map<string, { date: Date; inDays: number }>();
  for (let i = 0; i <= leadDays; i++) {
    const dt = new Date(base + i * 864e5);
    const key = `${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`;
    if (!window.has(key)) window.set(key, { date: dt, inDays: i });
  }

  const events = await db.event.findMany({
    where: {
      type: { in: ["Birth", "Death", "Burial", "Marriage"] },
      dateMonth: { not: null },
      dateDay: { not: null },
      ...(treeId ? { treeId } : { tree: { anniversaryReminders: true } }),
    },
    select: {
      id: true,
      type: true,
      treeId: true,
      dateYear: true,
      dateMonth: true,
      dateDay: true,
      eventRefs: {
        select: {
          role: true,
          person: {
            select: {
              id: true,
              living: true,
              names: { select: NAME_SELECT },
              eventRefs: {
                where: { event: { is: { type: { in: ["Death", "Burial"] } } } },
                select: { id: true },
              },
            },
          },
          family: {
            select: {
              id: true,
              partner1: { select: { id: true, names: { select: NAME_SELECT }, living: true } },
              partner2: { select: { id: true, names: { select: NAME_SELECT }, living: true } },
            },
          },
        },
      },
    },
  });

  const out: Anniversary[] = [];

  for (const e of events) {
    if (e.dateMonth == null || e.dateDay == null) continue;
    const hit = window.get(`${e.dateMonth}-${e.dateDay}`);
    if (!hit) continue;
    const years = e.dateYear ? hit.date.getUTCFullYear() - e.dateYear : null;
    const on = dayLabel(e.dateMonth, e.dateDay);

    if (e.type === "Marriage") {
      const fam = e.eventRefs.find((r) => r.family)?.family;
      if (!fam) continue;
      const a = fam.partner1 ? displayName(fam.partner1.names) : "—";
      const b = fam.partner2 ? displayName(fam.partner2.names) : "—";
      const bothGone = !fam.partner1?.living && !fam.partner2?.living;
      if (bothGone) continue;
      out.push({
        eventId: e.id,
        treeId: e.treeId,
        kind: "wedding",
        date: hit.date,
        inDays: hit.inDays,
        years,
        personId: fam.partner1?.id ?? fam.partner2?.id ?? null,
        familyId: fam.id,
        title: `💍 ${a} & ${b}${years ? ` — ${years} years` : ""}`,
        detail: `Wedding anniversary · ${on}`,
      });
      continue;
    }

    const person = e.eventRefs.find((r) => r.role === "PRIMARY" && r.person)?.person;
    if (!person) continue;
    const name = displayName(person.names);
    const deceased = person.eventRefs.length > 0;

    if (e.type === "Birth") {
      if (deceased) continue; // celebrate living birthdays only
      out.push({
        eventId: e.id,
        treeId: e.treeId,
        kind: "birthday",
        date: hit.date,
        inDays: hit.inDays,
        years,
        personId: person.id,
        familyId: null,
        title: `🎂 ${name}${years ? ` turns ${years}` : "’s birthday"}`,
        detail: hit.inDays === 0 ? `Today · ${on}` : `${on} · in ${hit.inDays} day${hit.inDays === 1 ? "" : "s"}`,
      });
    } else {
      // Death / Burial
      out.push({
        eventId: e.id,
        treeId: e.treeId,
        kind: "death",
        date: hit.date,
        inDays: hit.inDays,
        years,
        personId: person.id,
        familyId: null,
        title: `🕯️ Remembering ${name}`,
        detail: `${years ? `${years} years` : "Anniversary"} · ${on}`,
      });
    }
  }

  out.sort((a, b) => a.inDays - b.inDays || a.title.localeCompare(b.title));
  return out;
}
