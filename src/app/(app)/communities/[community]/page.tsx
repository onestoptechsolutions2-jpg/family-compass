import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ community: string }>;
}) {
  const { community } = await params;
  return { title: `${decodeURIComponent(community)} clans` };
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ community: string }>;
}) {
  await requireUser();
  const { community: raw } = await params;
  const community = decodeURIComponent(raw);

  const clans = await db.referenceClan.findMany({
    where: { community },
    orderBy: { name: "asc" },
    select: { id: true, name: true, aka: true, totem: true, region: true, notes: true },
  });
  if (clans.length === 0) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Link href="/communities" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Communities
      </Link>
      <h1 className="text-lg font-semibold">{community}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {clans.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border p-4 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="font-medium">{c.name}</div>
            {c.aka && <div style={{ color: "var(--muted)" }}>a.k.a. {c.aka}</div>}
            <div style={{ color: "var(--muted)" }}>
              {[c.totem && `totem: ${c.totem}`, c.region].filter(Boolean).join(" · ")}
            </div>
            {c.notes && <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{c.notes}</div>}
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Something wrong or missing? Add the corrected clan in your tree&apos;s Clans tab; curated
        updates are reviewed.
      </p>
    </div>
  );
}
