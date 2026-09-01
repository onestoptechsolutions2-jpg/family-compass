import { db } from "@/lib/db";

/**
 * The "About me" questionnaire — the research payload. Short, reflective,
 * filled only by the claimed person. Free-text fields + one 1–5 feeling.
 */
export const SELF_QUESTIONS = [
  { field: "familyMeans", label: "Who is family to you?", kind: "long" },
  {
    field: "belonging",
    label: "Where do you feel you belong?",
    kind: "short",
    hint: "a place, a people, a faith, a diaspora — or nowhere yet",
  },
  { field: "strongestTie", label: "Your strongest family tie now — and in childhood. Same or different?", kind: "long" },
  { field: "gaveAndCost", label: "What did this family give you? What did it cost you?", kind: "long" },
  { field: "forDescendant", label: "One sentence you'd want a descendant to read.", kind: "long" },
] as const;

export type SelfNodeData = {
  familyMeans: string | null;
  belonging: string | null;
  strongestTie: string | null;
  forDescendant: string | null;
  gaveAndCost: string | null;
  familyFeeling: number | null;
  familyFeelingWord: string | null;
};

export async function getSelfNode(personId: string) {
  return db.selfNode.findUnique({
    where: { personId },
    select: {
      familyMeans: true,
      belonging: true,
      strongestTie: true,
      forDescendant: true,
      gaveAndCost: true,
      familyFeeling: true,
      familyFeelingWord: true,
      updatedAt: true,
    },
  });
}

const clip = (v: unknown, n: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

export async function saveSelfNode(
  personId: string,
  by: string | null,
  input: Record<string, unknown>,
): Promise<void> {
  const feeling = Number(input.familyFeeling);
  const data = {
    familyMeans: clip(input.familyMeans, 4000),
    belonging: clip(input.belonging, 200),
    strongestTie: clip(input.strongestTie, 4000),
    forDescendant: clip(input.forDescendant, 500),
    gaveAndCost: clip(input.gaveAndCost, 4000),
    familyFeeling: feeling >= 1 && feeling <= 5 ? feeling : null,
    familyFeelingWord: clip(input.familyFeelingWord, 40),
    updatedById: by,
  };
  await db.selfNode.upsert({
    where: { personId },
    create: { personId, ...data },
    update: data,
  });
}

/** How complete the About-me is (0–1), for the wizard and dashboard. */
export function selfNodeCompleteness(n: SelfNodeData | null): number {
  if (!n) return 0;
  const parts = [
    n.familyMeans,
    n.belonging,
    n.strongestTie,
    n.gaveAndCost,
    n.forDescendant,
    n.familyFeeling != null ? "x" : null,
  ];
  return parts.filter(Boolean).length / parts.length;
}
