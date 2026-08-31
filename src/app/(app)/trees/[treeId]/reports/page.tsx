import Link from "next/link";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { getTreeStatistics, getReportDrilldown } from "@/lib/queries/statistics";
import { claimStatusReport, CLAIM_CATEGORIES } from "@/lib/queries/claim-report";
import { treeViewSummary } from "@/lib/queries/view-analytics";
import { genderColor, genderSymbol } from "@/lib/person";
import { CopyButton } from "@/components/CopyButton";
import { sendClaimLink } from "./actions";

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
  searchParams: Promise<{ d?: string; claimOk?: string; claimErr?: string }>;
}) {
  const { treeId } = await params;
  const { d, claimOk, claimErr } = await searchParams;
  const ctx = await loadTreeContext(treeId);
  const editable = canEdit(ctx.role);
  const [s, claims, reach, origin] = await Promise.all([
    getTreeStatistics(treeId),
    claimStatusReport(treeId),
    treeViewSummary(treeId),
    publicOrigin(),
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

      <section id="claims" className="flex scroll-mt-4 flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold">Account claims</h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Which profiles are tied to a login, invited, or still open. Send a claim link straight
            from here — the link goes to the owner, they confirm, a manager approves.
          </p>
        </div>

        {claimErr && (
          <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
            {decodeURIComponent(claimErr)}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CLAIM_CATEGORIES.map((c) => (
            <a key={c.id} href={`#claim-${c.id}`} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="text-2xl font-semibold">{claims.counts[c.id]}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</div>
            </a>
          ))}
        </div>

        {CLAIM_CATEGORIES.filter((c) => claims.rows[c.id].length > 0).map((c) => (
          <Card key={c.id}>
            <h4 id={`claim-${c.id}`} className="scroll-mt-4 font-medium">
              {c.label} · {claims.counts[c.id]}
            </h4>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{c.hint}</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {claims.rows[c.id].map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/trees/${treeId}/people/${r.id}`} className="font-medium hover:underline">
                    {genderSymbol(r.gender) && (
                      <span className="mr-1" style={{ color: genderColor(r.gender) }}>{genderSymbol(r.gender)}</span>
                    )}
                    {r.name}
                  </Link>
                  {r.category === "claimed" && r.claimedByName && (
                    <span className="text-xs" style={{ color: "var(--muted)" }}>· {r.claimedByName}</span>
                  )}
                  {r.inviteToken && (
                    <span className="flex items-center gap-1.5 text-xs">
                      <code className="rounded bg-black/5 px-1.5 py-0.5">{origin}/claim/{r.inviteToken}</code>
                      <CopyButton value={`${origin}/claim/${r.inviteToken}`} label="Copy" />
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Hi ${r.name} — this is your profile on our family tree. Confirm it's you: ${origin}/claim/${r.inviteToken}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded px-1.5 py-0.5 font-medium text-white"
                        style={{ background: "#25D366" }}
                      >
                        WhatsApp
                      </a>
                    </span>
                  )}
                  {editable && (r.category === "claimable" || r.category === "invited") && (
                    <form action={sendClaimLink.bind(null, treeId, r.id)}>
                      <button className="rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)" }}>
                        {r.category === "invited" ? "New link" : "Send claim link"}
                        {claimOk === r.id ? " ✓" : ""}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>
    </div>
  );
}
