import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { listEvents } from "@/lib/queries/misc";

export const metadata = { title: "Events" };

export default async function EventsPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  await loadTreeContext(treeId);
  const events = await listEvents(treeId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {events.length} events
      </p>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">People</th>
              <th className="px-3 py-2 font-medium">Place</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {e.date || "—"}
                </td>
                <td className="px-3 py-2 font-medium">{e.type}</td>
                <td className="px-3 py-2">
                  {e.people.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link href={`/trees/${treeId}/people/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {e.place || "—"}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
