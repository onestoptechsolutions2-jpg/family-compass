import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { getTreeStatistics, getReportDrilldown } from "@/lib/queries/statistics";
import { treeViewSummary } from "@/lib/queries/view-analytics";
import { genderColor } from "@/lib/person";

export const metadata = { title: "Reports" };
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

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <Card className={href ? "transition-colors hover:border-[var(--color-brand-600)]" : ""}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Bars({ rows, base }: { rows: { label: string; count: number }[]; base: (label: string) => string | null }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="mt-3 flex flex-col gap-1.5 text-sm">
      {rows.map((r) => {
        const href = base(r.label);
        const row = (
          <span className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-right text-xs" style={{ color: "var(--muted)" }}>{r.label}</span>
            <span className="h-3 flex-1 overflow-hidden rounded" style={{ background: "var(--surface-2)" }}>
              <span className="block h-full rounded" style={{ width: `${(r.count / max) * 100}%`, background: "var(--color-brand-500)" }} />
            </span>
            <span className="w-8 shrink-0 text-xs tabular-nums" style={{ color: "var(--muted)" }}>{r.count}</span>
          </span>
        );
        return (
          <li key={r.label}>
            {href ? <Link href={href} className="block hover:opacity-80">{row}</Link> : row}
          </li>
        );
      })}
      {rows.length === 0 && (
        <li className="text-xs" style={{ color: "var(--muted)" }}>Not enough dated records yet.</li>
      )}
    </ul>
  );
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { treeId } = await params;
  const { d } = await searchParams;
  await loadTreeContext(treeId);
  const [s, reach] = await Promise.all([
    getTreeStatistics(treeId),
    treeViewSummary(treeId),
  ]);
  const drill = d ? await getReportDrilldown(treeId, d) : null;
  const base = `/trees/${treeId}/reports`;
  const q = (key: string) => `${base}?d=${encodeURIComponent(key)}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Reports</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          A live snapshot of this tree. Tap any figure or bar to see the people behind it.
        </p>
      </div>

      {drill && (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{drill.title} · {drill.people.length}</h3>
            <Link href={base} className="text-sm hover:underline" style={{ color: "var(--link)" }}>clear</Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {drill.people.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/trees/${treeId}/people/${p.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm hover:shadow-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  {p.deceased && <span title="Deceased" style={{ color: "var(--muted)" }}>†</span>}
                  {p.symbol && <span style={{ color: genderColor(p.gender) }}>{p.symbol}</span>}
                  {p.name}
                  {p.years && <span className="text-xs" style={{ color: "var(--muted)" }}>{p.years}</span>}
                </Link>
              </li>
            ))}
            {drill.people.length === 0 && (
              <li className="text-sm" style={{ color: "var(--muted)" }}>No matching people.</li>
            )}
          </ul>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="People" value={s.totals.people} />
        <Stat label="Families" value={s.totals.families} />
        <Stat label="Events" value={s.totals.events} />
        <Stat label="Places" value={s.totals.places} />
        <Stat label="Sources" value={s.totals.sources} />
        <Stat label="Living" value={s.totals.living} href={q("living")} />
        <Stat label="Deceased" value={s.totals.deceased} href={q("deceased")} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-medium">Composition</h3>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Men</span>
              <Link href={q("sex:MALE")} className="tabular-nums hover:underline" style={{ color: "var(--link)" }}>{s.sex.male}</Link>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Women</span>
              <Link href={q("sex:FEMALE")} className="tabular-nums hover:underline" style={{ color: "var(--link)" }}>{s.sex.female}</Link>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Unspecified sex</span>
              <Link href={q("sex:UNKNOWN")} className="tabular-nums hover:underline" style={{ color: "var(--link)" }}>{s.sex.unknown}</Link>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Missing a photo</span>
              <Link href={q("nophoto")} className="tabular-nums hover:underline" style={{ color: "var(--link)" }}>
                {s.totals.people - s.coverage.withPhoto}
              </Link>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Average lifespan</span>
              <span className="tabular-nums">{s.avgLifespan ? `${s.avgLifespan} yrs` : "—"}</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Average children / family</span>
              <span className="tabular-nums">{s.avgChildren}</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Oldest living</span>
              <span>{s.oldestLiving ? `${s.oldestLiving.name} (b. ${s.oldestLiving.year})` : "—"}</span>
            </li>
          </ul>
        </Card>

        <Card>
          <h3 className="font-medium">Largest families</h3>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {s.largestFamilies.map((f) => (
              <li key={f.id} className="flex justify-between gap-2">
                <Link href={`/trees/${treeId}/families/${f.id}`} className="hover:underline">{f.partners}</Link>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>{f.children} children</span>
              </li>
            ))}
            {s.largestFamilies.length === 0 && (
              <li className="text-xs" style={{ color: "var(--muted)" }}>No families with children yet.</li>
            )}
          </ul>
        </Card>

        <Card>
          <h3 className="font-medium">Births by decade</h3>
          <Bars rows={s.birthsByDecade} base={(l) => q(`born:${l}`)} />
        </Card>
        <Card>
          <h3 className="font-medium">Deaths by decade</h3>
          <Bars rows={s.deathsByDecade} base={(l) => q(`died:${l}`)} />
        </Card>
        <Card>
          <h3 className="font-medium">Top surnames</h3>
          <Bars rows={s.topSurnames} base={(l) => q(`surname:${l}`)} />
        </Card>
        <Card>
          <h3 className="font-medium">Clans represented</h3>
          <Bars rows={s.topClans} base={() => null} />
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold">Public reach</h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Where people who opened this tree&apos;s public links (shared trees, memorials,
            contribution pages) are — from their browser timezone, last 30 days. No accounts, no
            stored addresses.
          </p>
        </div>
        {reach.total === 0 ? (
          <Card>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No public views yet. Share a link and check back.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="flex gap-6">
                <div>
                  <div className="text-2xl font-semibold">{reach.total}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>views (30d)</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">{reach.uniques}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>visitors</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">{reach.last7}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>last 7 days</div>
                </div>
              </div>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {reach.byDevice.map((r) => (
                  <li key={r.label} className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>{r.label}</span>
                    <span className="tabular-nums">{r.n}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h4 className="font-medium">Where they are</h4>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {(reach.byRegion.length ? reach.byRegion : reach.byCountry).map((r) => (
                  <li key={r.label} className="flex justify-between">
                    <span className="truncate" style={{ color: "var(--muted)" }}>{r.label}</span>
                    <span className="tabular-nums">{r.n}</span>
                  </li>
                ))}
                {reach.byRegion.length === 0 && reach.byCountry.length === 0 && (
                  <li className="text-xs" style={{ color: "var(--muted)" }}>Not enough signal yet.</li>
                )}
              </ul>
            </Card>
            <Card>
              <h4 className="font-medium">How they arrived</h4>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {reach.byReferrer.map((r) => (
                  <li key={r.label} className="flex justify-between">
                    <span className="truncate" style={{ color: "var(--muted)" }}>{r.label}</span>
                    <span className="tabular-nums">{r.n}</span>
                  </li>
                ))}
                {reach.byReferrer.length === 0 && (
                  <li className="text-xs" style={{ color: "var(--muted)" }}>Mostly direct / shared privately.</li>
                )}
              </ul>
            </Card>
          </div>
        )}
      </section>

      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Looking for who has claimed their profile?{" "}
        <Link href={`/trees/${treeId}/claims#accounts`} className="hover:underline" style={{ color: "var(--link)" }}>
          Account claims moved to the Claims page →
        </Link>
      </p>
    </div>
  );
}
