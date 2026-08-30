import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getPaymentSettings } from "@/lib/payments";
import { searchDirectory, previewSummary } from "@/lib/discovery";
import { startDeepSearch } from "./actions";

export const metadata = { title: "Deep search" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; clan?: string; community?: string; region?: string; birthYear?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const style = { borderColor: "var(--border)", background: "var(--bg)" };
  const settings = await getPaymentSettings();

  const hasQuery = Boolean(sp.name || sp.clan || sp.community);
  const query = {
    name: sp.name,
    clan: sp.clan,
    community: sp.community,
    region: sp.region,
    birthYear: sp.birthYear ? Number(sp.birthYear) : undefined,
  };
  const preview = hasQuery ? previewSummary(await searchDirectory(query)) : null;

  const mine = await db.deepSearch.findMany({
    where: { requesterId: me.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, query: true, resultCount: true, status: true, createdAt: true },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Deep search across families</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Check whether someone is from your bloodline or clan — across every family tree whose
          owner joined the research directory. The free preview shows how many matches exist;
          unlock the details for {settings.currency} {settings.deepSearchPriceKes.toLocaleString()}.
        </p>
      </div>

      <form method="get" className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Name</span>
          <input name="name" defaultValue={sp.name} className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Clan</span>
          <input name="clan" defaultValue={sp.clan} className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Community</span>
          <input name="community" defaultValue={sp.community} placeholder="Luhya, Kikuyu…" className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Region</span>
          <input name="region" defaultValue={sp.region} className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Approx. birth year</span>
          <input name="birthYear" type="number" defaultValue={sp.birthYear} className={field} style={style} />
        </label>
        <div className="sm:col-span-2">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Search
          </button>
        </div>
      </form>

      {preview && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-2xl font-semibold">{preview.count} possible match{preview.count === 1 ? "" : "es"}</div>
          {preview.count > 0 ? (
            <>
              <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {preview.clans.length > 0 && <>Clans: {preview.clans.slice(0, 6).join(", ")}. </>}
                {preview.communities.length > 0 && <>Communities: {preview.communities.join(", ")}. </>}
                {preview.decades.length > 0 && <>Born: {preview.decades.sort().join(", ")}.</>}
              </div>
              <form action={startDeepSearch} className="mt-3">
                {(["name", "clan", "community", "region", "birthYear"] as const).map((k) =>
                  sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null,
                )}
                <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  Unlock full results — {settings.currency} {settings.deepSearchPriceKes.toLocaleString()}
                </button>
              </form>
            </>
          ) : (
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Nobody matching is in the directory yet. Try fewer filters, or invite that family
              to build their tree.
            </p>
          )}
        </div>
      )}

      {mine.length > 0 && (
        <div>
          <h2 className="text-sm font-medium">Your deep searches</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {mine.map((s) => {
              const q = s.query as { name?: string; clan?: string };
              return (
                <li key={s.id}>
                  <Link href={`/discover/${s.id}`} className="hover:underline">
                    {[q.name, q.clan].filter(Boolean).join(" · ") || "search"}
                  </Link>{" "}
                  <span style={{ color: "var(--muted)" }}>
                    · {s.resultCount} matches · {s.status.toLowerCase()}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
