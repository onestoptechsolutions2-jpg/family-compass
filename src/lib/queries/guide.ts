import { db } from "@/lib/db";

export type GuideStep = {
  key: string;
  title: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
};

/** The "getting started" checklist for a tree, with each step's done-state
 *  computed from the tree's actual data. */
export async function getTreeGuide(treeId: string) {
  const tree = await db.tree.findUniqueOrThrow({
    where: { id: treeId },
    select: {
      homePersonId: true,
      workspace: { select: { _count: { select: { memberships: true } } } },
      _count: {
        select: { people: true, families: true, events: true, media: true, sharedViews: true, clans: true },
      },
    },
  });
  const c = tree._count;
  const base = `/trees/${treeId}`;

  const steps: GuideStep[] = [
    {
      key: "people",
      title: "Add people",
      hint: "Start with yourself, then add the relatives you know.",
      href: `${base}/people/new`,
      cta: "Add a person",
      done: c.people > 0,
    },
    {
      key: "relations",
      title: "Connect the family",
      hint: "On a person's page use + father / + mother / + partner / + child.",
      href: `${base}/people`,
      cta: "Open people",
      done: c.families > 0,
    },
    {
      key: "dates",
      title: "Record dates & places",
      hint: "Add birth, death and marriage dates so charts and reports work.",
      href: `${base}/people`,
      cta: "Add details",
      done: c.events > 0,
    },
    {
      key: "clans",
      title: "Record clans",
      hint: "Set each person's clan and sub-clan; browse the reference list.",
      href: `${base}/clans`,
      cta: "Open clans",
      done: c.clans > 0,
    },
    {
      key: "photos",
      title: "Add photos",
      hint: "Attach portraits and documents to people and events.",
      href: `${base}/media`,
      cta: "Open media",
      done: c.media > 0,
    },
    {
      key: "home",
      title: "Pick a home person",
      hint: "Open the tree view, centre on someone, and “Set as home”.",
      href: `${base}/tree`,
      cta: "Open tree view",
      done: !!tree.homePersonId,
    },
    {
      key: "share",
      title: "Share a branch",
      hint: "Create a read-only link centred on one person (living people redacted).",
      href: `${base}/sharing`,
      cta: "Create a link",
      done: c.sharedViews > 0,
    },
    {
      key: "invite",
      title: "Invite a relative",
      hint: "Add a workspace member so others can contribute.",
      href: `${base}/sharing`,
      cta: "Invite",
      done: tree.workspace._count.memberships > 1,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length };
}
