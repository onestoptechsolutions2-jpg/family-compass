import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessError, loadTreeContext } from "@/lib/rbac";
import { NavTabs } from "@/components/NavTabs";
import { chamaEnabled } from "@/lib/chama/plugin";

export default async function TreeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  let ctx;
  try {
    ctx = await loadTreeContext(treeId);
  } catch (err) {
    if (err instanceof AccessError && err.status === 404) notFound();
    throw err;
  }

  const base = `/trees/${treeId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/people`, label: "People" },
    { href: `${base}/media`, label: "Media" },
    {
      label: "Records",
      tabs: [
        { href: `${base}/families`, label: "Family units" },
        { href: `${base}/events`, label: "Events" },
        { href: `${base}/places`, label: "Places" },
        { href: `${base}/sources`, label: "Sources" },
        { href: `${base}/clans`, label: "Clans" },
      ],
    },
    {
      label: "Explore",
      tabs: [
        { href: `${base}/tree`, label: "Tree view" },
        { href: `${base}/charts`, label: "Charts" },
        { href: `${base}/reports`, label: "Reports" },
        { href: `${base}/relationship`, label: "Are we related?" },
        { href: `${base}/updates`, label: "Updates" },
      ],
    },
    {
      label: "Sharing",
      tabs: [
        { href: `${base}/sharing`, label: "Shared links" },
        { href: `${base}/claims`, label: "Claims" },
        ...(chamaEnabled() ? [{ href: `${base}/chama`, label: "Chama" }] : []),
      ],
    },
    {
      label: "Manage",
      tabs: [
        { href: `${base}/import`, label: "Import" },
        { href: `${base}/settings`, label: "Settings" },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/app" className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
            {ctx.workspace.name} / all trees
          </Link>
          <h1 className="text-xl font-semibold">{ctx.tree.name}</h1>
        </div>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          role: {ctx.role.toLowerCase()}
        </span>
      </div>
      <NavTabs tabs={tabs} />
      <div>{children}</div>
    </div>
  );
}
