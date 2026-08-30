import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext } from "@/lib/rbac";
import { getTreeStatistics } from "@/lib/queries/statistics";

export const dynamic = "force-dynamic";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </Card>
  );
}

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="mt-3 flex flex-col gap-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-right text-xs" style={{ color: "var(--muted)" }}>
            {r.label}
          </span>
          <span className="h-3 flex-1 overflow-hidden rounded" style={{ background: "var(--bg)" }}>
            <span
              className="block h-full rounded"
              style={{ width: `${(r.count / max) * 100}%`, background: "var(--color-brand-500)" }}
            />
          </span>
          <span className="w-8 shrink-0 text-xs tabular-nums" style={{ color: "var(--muted)" }}>
            {r.count}
          </span>
        </li>
      ))}
      {rows.length === 0 && (
        <li className="text-xs" style={{ color: "var(--muted)" }}>
          Not enough dated records yet.
        </li>
      )}
    </ul>
  );
}

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  if (!ctx) notFound();
  const s = await getTreeStatistics(treeId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Statistics</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          A live snapshot of this tree. Figures update as records are added.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="People" value={s.totals.people} />
        <Stat label="Families" value={s.totals.families} />
        <Stat label="Events" value={s.totals.events} />
        <Stat label="Places" value={s.totals.places} />
        <Stat label="Sources" value={s.totals.sources} />
        <Stat label="Living" value={s.totals.living} />
        <Stat label="Deceased" value={s.totals.deceased} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-medium">Composition</h3>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Men / women / unspecified</span>
              <span className="tabular-nums">
                {s.sex.male} / {s.sex.female} / {s.sex.unknown}
              </span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Have a photo attached</span>
              <span className="tabular-nums">
                {s.coverage.withPhoto} ({s.coverage.withPhotoPct}%)
              </span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Average lifespan</span>
              <span className="tabular-nums">
                {s.avgLifespan ? `${s.avgLifespan} yrs` : "—"}
                {s.coverage.lifespanSample ? ` (n=${s.coverage.lifespanSample})` : ""}
              </span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Average children per family</span>
              <span className="tabular-nums">{s.avgChildren}</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Oldest living</span>
              <span>{s.oldestLiving ? `${s.oldestLiving.name} (b. ${s.oldestLiving.year})` : "—"}</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Youngest recorded</span>
              <span>
                {s.youngestLiving ? `${s.youngestLiving.name} (b. ${s.youngestLiving.year})` : "—"}
              </span>
            </li>
          </ul>
        </Card>

        <Card>
          <h3 className="font-medium">Largest families</h3>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {s.largestFamilies.map((f) => (
              <li key={f.id} className="flex justify-between gap-2">
                <Link href={`/trees/${treeId}/families/${f.id}`} className="hover:underline">
                  {f.partners}
                </Link>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
                  {f.children} children
                </span>
              </li>
            ))}
            {s.largestFamilies.length === 0 && (
              <li className="text-xs" style={{ color: "var(--muted)" }}>
                No families with children yet.
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <h3 className="font-medium">Births by decade</h3>
          <Bars rows={s.birthsByDecade} />
        </Card>

        <Card>
          <h3 className="font-medium">Deaths by decade</h3>
          <Bars rows={s.deathsByDecade} />
        </Card>

        <Card>
          <h3 className="font-medium">Top surnames</h3>
          <Bars rows={s.topSurnames} />
        </Card>

        <Card>
          <h3 className="font-medium">Clans represented</h3>
          <Bars rows={s.topClans} />
        </Card>
      </section>
    </div>
  );
}
