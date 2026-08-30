import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { db } from "@/lib/db";
import { collectAnniversaries } from "@/lib/queries/anniversaries";

export const metadata = { title: "Updates" };

function ago(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return d.toISOString().slice(0, 10);
}

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await loadTreeContext(treeId);

  const anniversaries = await collectAnniversaries(treeId, 30);

  const events = await db.activityEvent.findMany({
    where: { treeId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      verb: true,
      objectType: true,
      objectId: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Upcoming anniversaries</h2>
        {anniversaries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Nothing in the next 30 days. Birthdays and death &amp; wedding anniversaries with a known
            day appear here, and the family is reminded a week ahead.
          </p>
        ) : (
          <ul className="flex flex-col">
            {anniversaries.map((a) => {
              const href =
                a.kind === "wedding" && a.familyId
                  ? `/trees/${treeId}/families/${a.familyId}`
                  : a.personId
                    ? `/trees/${treeId}/people/${a.personId}`
                    : `/trees/${treeId}`;
              return (
                <li
                  key={`${a.eventId}-${a.kind}`}
                  className="flex items-baseline justify-between gap-3 border-b py-2 text-sm last:border-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Link href={href} className="hover:underline">
                    {a.title}
                  </Link>
                  <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                    {a.detail}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Recent activity</h2>
      {events.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Nothing yet. Edits, imports and shared links will show up here.
        </p>
      ) : (
        <ul className="flex flex-col">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-baseline justify-between gap-3 border-b py-2 text-sm last:border-0"
              style={{ borderColor: "var(--border)" }}
            >
              <span>
                <span className="font-medium">{e.actor?.name ?? e.actor?.email ?? "Someone"}</span>{" "}
                <span style={{ color: "var(--muted)" }}>{e.summary}</span>
              </span>
              <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                {ago(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      </section>
    </div>
  );
}
