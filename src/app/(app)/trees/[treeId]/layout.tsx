import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessError, loadTreeContext } from "@/lib/rbac";
import { NavTabs } from "@/components/NavTabs";

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
    { href: `${base}/families`, label: "Families" },
    { href: `${base}/clans`, label: "Clans" },
    { href: `${base}/relationship`, label: "Are we related?" },
    { href: `${base}/events`, label: "Events" },
    { href: `${base}/places`, label: "Places" },
    { href: `${base}/sources`, label: "Sources" },
    { href: `${base}/media`, label: "Media" },
    { href: `${base}/tree`, label: "Tree view" },
    { href: `${base}/charts`, label: "Charts" },
    { href: `${base}/reports`, label: "Reports" },
    { href: `${base}/sharing`, label: "Sharing" },
    { href: `${base}/chama`, label: "Chama" },
    { href: `${base}/claims`, label: "Claims" },
    { href: `${base}/updates`, label: "Updates" },
    { href: `${base}/import`, label: "Import" },
    { href: `${base}/settings`, label: "Settings" },
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
