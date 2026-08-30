import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "Communities" };

export default async function CommunitiesPage() {
  await requireUser();
  const rows = await db.referenceClan.groupBy({
    by: ["community"],
    _count: { _all: true },
    orderBy: { community: "asc" },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Communities &amp; clans</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          A community-curated reference. It&apos;s a starting point — correct and extend it from
          your own family knowledge as you build.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <Link
            key={r.community}
            href={`/communities/${encodeURIComponent(r.community)}`}
            className="rounded-xl border p-4 hover:shadow-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="font-medium">{r.community}</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {r._count._all} clans / sub-groups
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
