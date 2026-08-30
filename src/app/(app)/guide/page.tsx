import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "Guide" };
export const dynamic = "force-dynamic";

type Section = { title: string; steps: (string | { text: string; href: string; label: string })[] };

function Steps({ items, base }: { items: Section["steps"]; base: string | null }) {
  return (
    <ol className="mt-2 flex flex-col gap-1.5 text-[15px] leading-relaxed">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>{i + 1}.</span>
          {typeof s === "string" ? (
            <span>{s}</span>
          ) : (
            <span>
              {s.text}{" "}
              {base && (
                <Link href={base + s.href} className="hover:underline" style={{ color: "var(--link)" }}>
                  {s.label} →
                </Link>
              )}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ tree?: string }>;
}) {
  const user = await requireUser();
  const { tree } = await searchParams;

  // resolve a tree to deep-link into (the one asked for, else the first owned)
  let treeId = tree ?? null;
  if (!treeId) {
    const first = await db.tree.findFirst({
      where: { workspace: { memberships: { some: { userId: user.id } } } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    treeId = first?.id ?? null;
  }
  const base = treeId ? `/trees/${treeId}` : null;

  const sections: Section[] = [
    {
      title: "1 · Build a tree by hand",
      steps: [
        { text: "Add yourself first, then work outwards.", href: "/people/new", label: "Add a person" },
        "On a person's page, use the + father / + mother / + partner / + child buttons. Each opens a small form — or link someone already in the tree from the picker at the top.",
        "Fill in birth, death and marriage dates and places. Charts, reports and the memorial book all read these.",
        "Mark a person deceased with “Record a death” — that unlocks their memorial page.",
      ],
    },
    {
      title: "2 · Import existing data",
      steps: [
        { text: "Upload a .gramps or GEDCOM file — people, families and events are matched and inserted.", href: "/import", label: "Import" },
        "Review the import summary for duplicates before you keep building.",
      ],
    },
    {
      title: "3 · Clans, places & communities",
      steps: [
        { text: "Set each person's clan and sub-clan; the reference list covers the main Kenyan communities.", href: "/clans", label: "Clans" },
        "Type a place and it autocompletes from all 47 counties down to ward level; villages you type are remembered.",
        { text: "Check whether two people share a bloodline or clan before a marriage.", href: "/relationship", label: "Are we related?" },
      ],
    },
    {
      title: "4 · Explore & share",
      steps: [
        { text: "Open the tree view, pan and zoom, click a card to re-centre, and use “Set as home”.", href: "/tree", label: "Tree view" },
        "Turn on the timeline (⏱) to watch the family grow and thin year by year.",
        { text: "Create a read-only shared link centred on one person. Living people are redacted unless you opt in; add a password or expiry if you want.", href: "/sharing", label: "Sharing" },
        "Send a specific relative a claim link from their profile so they can confirm it's them and keep it updated — you approve every claim.",
      ],
    },
    {
      title: "5 · Memorials & funeral programmes",
      steps: [
        "On a deceased person's page, open the memorial. Pick a page style (classic / profile / modern / feed).",
        "Use the Biography wizard for education, work, faith, character, illness, last words and favourite scripture — the dates, places and family are pulled from the tree automatically. Then rebuild the eulogy.",
        "Use a programme template (Christian two-day / one-day, celebration of life, Muslim) then edit items with the overlay add / edit / reorder / remove — items can span multiple days and carry a map location.",
        "Invite relatives to contribute memories; review and merge each one; then Finalise & lock the copy (a manager can unlock it later).",
        "Publish to get the /m/… link (with a QR); the guestbook collects tributes.",
      ],
    },
    {
      title: "6 · Downloads & payments",
      steps: [
        { text: "Generate a pedigree, fan, descendant chart, family book or the full memorial book. You see a watermarked preview first.", href: "/charts", label: "Charts" },
        "Pay per download to your M-Pesa Till, paste the transaction code, and an admin verifies it to unlock the clean file. A yearly Family plan gives unlimited downloads for one tree.",
      ],
    },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">How to use Family Compass</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          A short walkthrough. Each tree also shows a live “Getting started” checklist on its
          overview.
        </p>
      </div>

      {sections.map((sec) => (
        <section key={sec.title}>
          <h2 className="font-serif text-lg">{sec.title}</h2>
          <Steps items={sec.steps} base={base} />
        </section>
      ))}

      {base && (
        <Link
          href={base}
          className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to your tree
        </Link>
      )}
    </div>
  );
}
