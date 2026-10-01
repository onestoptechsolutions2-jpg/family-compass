import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { db } from "@/lib/db";
import { primaryName, NAME_SELECT } from "@/lib/person";
import { diceCoefficient } from "@/lib/identity";

export const metadata = { title: "Surnames" };

type Row = {
  surname: string;
  people: { id: string; name: string }[];
  clans: Map<string, number>; // clan name ("— none —" for blank) -> count
};

/** Normalize for grouping only — trims, case-folds, collapses whitespace.
 *  Display keeps the first-seen original casing, so "Otieno" and "otieno "
 *  group together but the list still reads naturally. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export default async function SurnamesPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await loadTreeContext(treeId);

  const people = await db.person.findMany({
    where: { treeId },
    select: {
      id: true,
      names: { select: NAME_SELECT },
      clan: { select: { name: true } },
    },
  });

  const groups = new Map<string, Row>();
  for (const p of people) {
    const n = primaryName(p.names);
    const surname = n?.surname?.trim();
    if (!surname) continue;

    const key = normalize(surname);
    let row = groups.get(key);
    if (!row) {
      row = { surname, people: [], clans: new Map() };
      groups.set(key, row);
    }
    row.people.push({ id: p.id, name: [n?.first, surname].filter(Boolean).join(" ") });
    const clanLabel = p.clan?.name ?? "— no clan set —";
    row.clans.set(clanLabel, (row.clans.get(clanLabel) ?? 0) + 1);
  }

  // Alphabetical by normalized surname — puts likely spelling variants
  // ("Otieno" / "Otiego") next to each other, which is the point: this page
  // exists to catch drift, not just to count people.
  const rows = [...groups.values()].sort((a, b) => normalize(a.surname).localeCompare(normalize(b.surname)));

  // Beyond alphabetical adjacency, explicitly score every pair of DIFFERENT
  // surnames for closeness (bigram similarity — the same measure deep-search
  // uses to match candidate identities) and surface the close-but-not-equal
  // ones as likely typos/spelling drift, smallest group first since that's
  // usually the one worth correcting.
  const SIMILARITY_THRESHOLD = 0.6;
  type NearMatch = { a: Row; b: Row; score: number };
  const nearMatches: NearMatch[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const score = diceCoefficient(rows[i]!.surname, rows[j]!.surname);
      if (score >= SIMILARITY_THRESHOLD) nearMatches.push({ a: rows[i]!, b: rows[j]!, score });
    }
  }
  nearMatches.sort((x, y) => y.score - x.score);

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-prose text-sm" style={{ color: "var(--muted)" }}>
        Every family name recorded in this tree, grouped and sorted alphabetically so spelling
        drift — &quot;Otieno&quot; next to &quot;Otiego&quot; — is easy to spot. A surname split
        across more than one clan below is worth a second look: either two branches that haven&apos;t
        been reconciled, or a typo. Fix people individually, or use{" "}
        <Link href={`/trees/${treeId}/settings`} className="hover:underline" style={{ color: "var(--link)" }}>
          Settings → Clan &amp; naming
        </Link>{" "}
        to backfill blanks from the lineage.
      </p>

      {nearMatches.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--danger)", background: "var(--card)" }}>
          <h2 className="text-sm font-medium text-red-600">Possible spelling variants</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            These pairs are close enough in spelling that one is likely a typo for the other —
            not flagged elsewhere because they don&apos;t normalize to the same key.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {nearMatches.map(({ a, b, score }) => {
              const [smaller, larger] = a.people.length <= b.people.length ? [a, b] : [b, a];
              return (
                <li key={`${a.surname}::${b.surname}`}>
                  <a href={`#surname-${normalize(smaller.surname)}`} className="font-medium hover:underline">
                    {smaller.surname}
                  </a>
                  <span style={{ color: "var(--muted)" }}> ({smaller.people.length}) vs </span>
                  <a href={`#surname-${normalize(larger.surname)}`} className="font-medium hover:underline">
                    {larger.surname}
                  </a>
                  <span style={{ color: "var(--muted)" }}>
                    {" "}
                    ({larger.people.length}) — {Math.round(score * 100)}% similar. Check whether{" "}
                    {smaller.people.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        <Link href={`/trees/${treeId}/people/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </span>
                    ))}{" "}
                    should read &quot;{larger.surname}&quot;.
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.surname}
            id={`surname-${normalize(r.surname)}`}
            className="rounded-xl border p-4 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-medium">{r.surname}</div>
              <div style={{ color: "var(--muted)" }}>
                {r.people.length} {r.people.length === 1 ? "person" : "people"}
              </div>
            </div>
            <ul className="mt-2 flex flex-col gap-0.5">
              {[...r.clans.entries()].map(([clan, count]) => (
                <li
                  key={clan}
                  className="flex items-baseline justify-between text-xs"
                  style={{ color: clan === "— no clan set —" ? "var(--muted)" : "inherit" }}
                >
                  <span>{clan}</span>
                  <span style={{ color: "var(--muted)" }}>{count}</span>
                </li>
              ))}
            </ul>
            {r.clans.size > 1 && (
              <p className="mt-2 text-xs" style={{ color: "var(--warning)" }}>
                Split across {r.clans.size} clans — worth checking.
              </p>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No family names recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
