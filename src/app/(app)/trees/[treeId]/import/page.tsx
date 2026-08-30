import { loadTreeContext, canManageTree } from "@/lib/rbac";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { startImport } from "./actions";

export const metadata = { title: "Import" };

type ImportReport = {
  people?: number;
  families?: number;
  events?: number;
  warnings?: string[];
};

export default async function ImportPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  if (!canManageTree(ctx.role)) notFound();

  const jobs = await db.importJob.findMany({
    where: { treeId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      kind: true,
      status: true,
      fileName: true,
      error: true,
      report: true,
      createdAt: true,
    },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Import a family tree</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Upload a Gramps <code>.gramps</code> file or a <code>.ged</code> GEDCOM (max 25 MB).
          Records are merged into this tree; a report appears below when it finishes.
        </p>
        <form action={startImport.bind(null, treeId)} className="mt-3 flex items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".gramps,.ged,.gedcom,.xml,.gpkg"
            required
            className="text-sm"
          />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Start import
          </button>
        </form>
      </section>

      <section>
        <h3 className="font-medium">Recent imports</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {jobs.map((j) => {
            const report = (j.report ?? null) as ImportReport | null;
            return (
              <li
                key={j.id}
                className="rounded-lg border p-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{j.fileName}</span>
                  <span
                    style={{
                      color:
                        j.status === "COMPLETED"
                          ? "#16a34a"
                          : j.status === "FAILED"
                            ? "#dc2626"
                            : "var(--muted)",
                    }}
                  >
                    {j.status.toLowerCase()}
                  </span>
                </div>
                <div style={{ color: "var(--muted)" }}>
                  {j.kind} · {j.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
                {report && (
                  <div className="mt-1" style={{ color: "var(--muted)" }}>
                    {report.people ?? 0} people · {report.families ?? 0} families ·{" "}
                    {report.events ?? 0} events
                    {report.warnings && report.warnings.length > 0 && (
                      <> · {report.warnings.length} warnings</>
                    )}
                  </div>
                )}
                {j.error && <div className="mt-1 text-red-600">{j.error}</div>}
              </li>
            );
          })}
          {jobs.length === 0 && (
            <li className="text-sm" style={{ color: "var(--muted)" }}>
              No imports yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
