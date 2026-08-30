import { loadTreeContext } from "@/lib/rbac";
import { listSources } from "@/lib/queries/misc";

export const metadata = { title: "Sources" };

export default async function SourcesPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  await loadTreeContext(treeId);
  const sources = await listSources(treeId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {sources.length} sources
      </p>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Author</th>
              <th className="px-3 py-2 font-medium">Citations</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-medium">{s.title}</td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {s.author || "—"}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {s._count.citations}
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                  No sources yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
