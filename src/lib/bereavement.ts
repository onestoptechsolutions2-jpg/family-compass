import { db } from "@/lib/db";
import { chamaEnabled } from "@/lib/chama/plugin";

export type BereaveStep = {
  key: string;
  done: boolean;
  label: string;
  href: string;
  cta: string;
};

/**
 * The steps a family works through after a death is recorded — burial,
 * memorial, funeral programme, inviting relatives, a welfare fund, publishing.
 * Returns null for a living person. Each step's `done` is read from real state,
 * so the checklist clears itself as the family goes.
 */
export async function bereavementSteps(
  treeId: string,
  personId: string,
): Promise<{ steps: BereaveStep[]; doneCount: number } | null> {
  const dead = await db.eventRef.findFirst({
    where: { personId, event: { type: { in: ["Death", "Burial"] } } },
    select: { id: true },
  });
  if (!dead) return null;

  const [burial, memorial, contributorCount] = await Promise.all([
    db.eventRef.findFirst({
      where: { personId, event: { type: "Burial" } },
      select: { id: true },
    }),
    db.memorial.findUnique({
      where: { personId },
      select: {
        id: true,
        published: true,
        restingPlace: true,
        program: { select: { order: true } },
        chamaFund: { select: { id: true } },
      },
    }),
    db.memorialContributor.count({ where: { memorial: { personId } } }),
  ]);

  const mBase = `/trees/${treeId}/people/${personId}/memorial`;
  const order = memorial?.program?.order;
  const progHasItems = Array.isArray(order) && order.length > 0;

  const steps: BereaveStep[] = [
    {
      key: "burial",
      done: !!burial || !!memorial?.restingPlace,
      label: "Record the burial — resting place and date",
      href: `${mBase}#tab=content`,
      cta: memorial ? "Set burial" : "Open memorial",
    },
    {
      key: "memorial",
      done: !!memorial,
      label: "Open the memorial page",
      href: mBase,
      cta: "Open",
    },
    {
      key: "programme",
      done: progHasItems,
      label: "Set the funeral programme — vigil, service, burial",
      href: `${mBase}#tab=service`,
      cta: "Build programme",
    },
    {
      key: "invite",
      done: contributorCount > 0,
      label: "Invite relatives to add memories and tributes",
      href: `${mBase}#tab=people`,
      cta: "Invite",
    },
    ...(chamaEnabled()
      ? [
          {
            key: "fund",
            done: !!memorial?.chamaFund,
            label: "Open a welfare fund for the funeral",
            href: `/trees/${treeId}/chama`,
            cta: "Open fund",
          },
        ]
      : []),
    {
      key: "publish",
      done: !!memorial?.published,
      label: "Publish the memorial when the family is ready",
      href: mBase,
      cta: "Publish",
    },
  ];

  return { steps, doneCount: steps.filter((s) => s.done).length };
}
