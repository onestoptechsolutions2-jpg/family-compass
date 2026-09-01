import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { searchDirectory, teaserRows, type DirectoryQuery } from "@/lib/discovery";
import { waLink } from "@/lib/wa";

export const metadata = { title: "Deep search results" };

export default async function DeepSearchResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireUser();
  const search = await db.deepSearch.findFirst({
    where: { id, requesterId: me.id },
    select: { id: true, query: true, status: true, paymentId: true, resultCount: true },
  });
  if (!search) notFound();

  if (search.status !== "PAID") {
    const teasers = teaserRows(await searchDirectory(search.query as DirectoryQuery));
    return (
      <main className="mx-auto max-w-md px-2 py-6">
        <Link href="/discover" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
          ← Deep search
        </Link>
        <h1 className="mt-1 text-lg font-semibold">
          {search.resultCount} possible match{search.resultCount === 1 ? "" : "es"}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Here&apos;s a glimpse. Full names, which tree each is in, and the family&apos;s WhatsApp
          are unlocked once payment is verified.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {teasers.map((t, i) => (
            <li
              key={i}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}
            >
              <span className="font-medium">{t.label}</span>
              <span style={{ color: "var(--muted)" }}>
                {[t.clan && `${t.clan} clan`, t.bornDecade && `b. ${t.bornDecade}`, t.place, t.living ? "living" : null]
                  .filter(Boolean)
                  .map((s) => ` · ${s}`)
                  .join("")}
              </span>
            </li>
          ))}
        </ul>
        {search.resultCount > teasers.length && (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            + {search.resultCount - teasers.length} more not shown.
          </p>
        )}
        {search.paymentId && (
          <Link
            href={`/pay/${search.paymentId}`}
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Complete payment
          </Link>
        )}
      </main>
    );
  }

  const q = search.query as DirectoryQuery;
  const candidates = await searchDirectory(q);
  const subject = [q.name, q.clan].filter(Boolean).join(" / ") || "your search";

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <Link href="/discover" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
          ← Deep search
        </Link>
        <h1 className="mt-1 text-lg font-semibold">
          {candidates.length} match{candidates.length === 1 ? "" : "es"} for {subject}
        </h1>
      </div>

      <ul className="flex flex-col gap-2">
        {candidates.map((c) => {
          const msg = `Hello — I'm researching family connections. I found a possible link to ${c.name}${
            c.clan ? ` (${c.clan} clan)` : ""
          } in your "${c.treeName}" family tree on Family Compass. Could we compare notes?`;
          return (
            <li
              key={c.personId}
              className="rounded-xl border p-3 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="font-medium">
                {c.name}
                {c.living ? <span style={{ color: "var(--muted)" }}> · living</span> : null}
              </div>
              <div style={{ color: "var(--muted)" }}>
                {[c.clan && `${c.clan} clan`, c.community, c.region, c.birthYear ? `b. ${c.birthYear}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div style={{ color: "var(--muted)" }}>in the “{c.treeName}” tree</div>
              <div className="mt-2">
                {c.ownerWhatsapp ? (
                  <a
                    href={waLink(c.ownerWhatsapp, msg)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Ask this family to connect (WhatsApp)
                  </a>
                ) : (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    This family hasn&apos;t shared a contact number.
                  </span>
                )}
              </div>
            </li>
          );
        })}
        {candidates.length === 0 && (
          <li className="text-sm" style={{ color: "var(--muted)" }}>
            No matches remain (records may have changed since the search).
          </li>
        )}
      </ul>
    </div>
  );
}
