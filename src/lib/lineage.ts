import { ClanInheritance, Gender } from "@prisma/client";

import { db } from "@/lib/db";
import { displayName, primaryName, NAME_SELECT } from "@/lib/person";

type PartnerRef = { id: string; gender: Gender } | null | undefined;

/**
 * Which partner a child takes their clan / family name from, by rule:
 * - PATRILINEAL  → the father (male partner), else the partner-1 slot
 * - MATRILINEAL  → the mother (female partner), else the partner-2 slot
 * - NONE         → neither
 * Pure so it can be unit-tested without the DB.
 */
export function lineageParent(p1: PartnerRef, p2: PartnerRef, mode: ClanInheritance): string | null {
  if (mode === ClanInheritance.NONE) return null;
  const parts = [p1, p2].filter(Boolean) as { id: string; gender: Gender }[];
  if (mode === ClanInheritance.PATRILINEAL) {
    return parts.find((p) => p.gender === Gender.MALE)?.id ?? p1?.id ?? p2?.id ?? null;
  }
  return parts.find((p) => p.gender === Gender.FEMALE)?.id ?? p2?.id ?? p1?.id ?? null;
}

export type LineageApplied = { clan?: string; surname?: string };

/**
 * Fill a newly-added child's blank clan / sub-clan / family name from the
 * lineage parent, per the tree's inheritance rule. Only ever fills blanks —
 * never overwrites something already set. Returns what it copied (for the
 * activity line), or null if nothing changed.
 */
export async function applyLineageInheritance(
  treeId: string,
  familyId: string,
  childId: string,
): Promise<LineageApplied | null> {
  const [tree, family, child] = await Promise.all([
    db.tree.findUnique({
      where: { id: treeId },
      select: { clanInheritance: true, inheritSurname: true },
    }),
    db.family.findFirst({
      where: { id: familyId, treeId },
      select: {
        partner1: { select: { id: true, gender: true, clanId: true, subClan: true, names: { select: NAME_SELECT } } },
        partner2: { select: { id: true, gender: true, clanId: true, subClan: true, names: { select: NAME_SELECT } } },
      },
    }),
    db.person.findFirst({
      where: { id: childId, treeId },
      select: { clanId: true, subClan: true, names: { select: { id: true, preferred: true, order: true, surname: true } } },
    }),
  ]);
  if (!tree || !family || !child) return null;

  const mode = tree.clanInheritance;
  const parentId = lineageParent(family.partner1, family.partner2, mode);
  if (!parentId) return null;
  const parent = [family.partner1, family.partner2].find((p) => p?.id === parentId);
  if (!parent) return null;

  const applied: LineageApplied = {};

  // clan (+ sub-clan) — only when the child has none yet
  if (!child.clanId && parent.clanId) {
    await db.person.update({
      where: { id: childId },
      data: { clanId: parent.clanId, subClan: child.subClan ?? parent.subClan ?? null },
    });
    const clan = await db.clan.findUnique({ where: { id: parent.clanId }, select: { name: true } });
    if (clan) applied.clan = clan.name;
  }

  // family name — copy to the child's preferred/first birth name when blank
  if (tree.inheritSurname) {
    const parentSurname = primaryName(parent.names)?.surname?.trim();
    const target =
      child.names.find((n) => n.preferred) ??
      [...child.names].sort((a, b) => a.order - b.order)[0] ??
      null;
    if (parentSurname && target && !target.surname?.trim()) {
      await db.name.update({ where: { id: target.id }, data: { surname: parentSurname } });
      applied.surname = parentSurname;
    }
  }

  return applied.clan || applied.surname ? applied : null;
}

export type NamesakeSuggestion = { id: string; name: string; label: string };

/**
 * Who a new child in this family could be named after, following the common
 * Kenyan patrilineal order: paternal grandfather, paternal grandmother,
 * maternal grandfather, maternal grandmother, then their parents. Only returns
 * people who actually exist in the tree. Purely advisory.
 */
export async function namesakeSuggestions(
  treeId: string,
  familyId: string,
): Promise<NamesakeSuggestion[]> {
  const family = await db.family.findFirst({
    where: { id: familyId, treeId },
    select: { partner1Id: true, partner2Id: true },
  });
  if (!family) return [];

  const parentIds = [family.partner1Id, family.partner2Id].filter(Boolean) as string[];
  if (parentIds.length === 0) return [];

  const rows = await db.childRef.findMany({
    where: { personId: { in: parentIds }, family: { treeId } },
    select: {
      personId: true,
      family: {
        select: {
          partner1: { select: { id: true, gender: true, names: { select: NAME_SELECT } } },
          partner2: { select: { id: true, gender: true, names: { select: NAME_SELECT } } },
        },
      },
    },
  });

  const grandparentsOf = (parentId: string) => {
    const r = rows.find((x) => x.personId === parentId);
    if (!r) return { father: null, mother: null };
    const parts = [r.family.partner1, r.family.partner2].filter(Boolean) as {
      id: string;
      gender: Gender;
      names: Parameters<typeof displayName>[0];
    }[];
    return {
      father: parts.find((p) => p.gender === Gender.MALE) ?? parts[0] ?? null,
      mother: parts.find((p) => p.gender === Gender.FEMALE) ?? parts[1] ?? null,
    };
  };

  const pat = family.partner1Id ? grandparentsOf(family.partner1Id) : { father: null, mother: null };
  const mat = family.partner2Id ? grandparentsOf(family.partner2Id) : { father: null, mother: null };

  const ordered: { p: { id: string; names: Parameters<typeof displayName>[0] } | null; label: string }[] = [
    { p: pat.father, label: "paternal grandfather" },
    { p: pat.mother, label: "paternal grandmother" },
    { p: mat.father, label: "maternal grandfather" },
    { p: mat.mother, label: "maternal grandmother" },
  ];

  const seen = new Set<string>();
  const out: NamesakeSuggestion[] = [];
  for (const { p, label } of ordered) {
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, name: displayName(p.names), label });
  }
  return out;
}
