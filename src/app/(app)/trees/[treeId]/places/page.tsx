import { loadTreeContext } from "@/lib/rbac";
import { listPlaces } from "@/lib/queries/misc";

export const metadata = { title: "Places" };

export default async function PlacesPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  await loadTreeContext(treeId);
  const places = await listPlaces(treeId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {places.length} places
      </p>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-3 py-2 font-medium">Place</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Coordinates</th>
              <th className="px-3 py-2 font-medium">Events</th>
            </tr>
          </thead>
          <tbody>
            {places.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-medium">{p.title}</td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {p.type || "—"}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : "—"}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {p._count.events}
                </td>
              </tr>
            ))}
            {places.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                  No places yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
