import Link from "next/link";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, kind: true, title: true, body: true, linkPath: true, readAt: true, createdAt: true },
  });
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="rounded-md border px-2.5 py-1 text-sm" style={{ borderColor: "var(--border)" }}>
              Mark all read ({unread})
            </button>
          </form>
        )}
      </div>

      {items.length === 0 && (
        <p className="rounded-xl border p-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          Nothing yet. Claims, guestbook messages, payments and integration events show up here.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const Inner = (
            <div
              className="rounded-xl border p-3"
              style={{
                borderColor: n.readAt ? "var(--border)" : "var(--color-brand-600)",
                background: "var(--card)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{n.title}</span>
                <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>{ago(n.createdAt)}</span>
              </div>
              {n.body && <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{n.body}</p>}
              <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}><code>{n.kind}</code></div>
            </div>
          );
          return (
            <li key={n.id} className="flex items-stretch gap-2">
              <div className="flex-1">
                {n.linkPath ? <Link href={n.linkPath}>{Inner}</Link> : Inner}
              </div>
              {!n.readAt && (
                <form action={markNotificationRead.bind(null, n.id)} className="flex items-center">
                  <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }} title="Mark read">
                    ✓
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
