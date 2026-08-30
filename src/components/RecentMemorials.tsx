import Link from "next/link";

import { getRecentMemorials } from "@/lib/queries/memorial";

/** A thin ribbon of the 3 most recent published memorials. */
export async function RecentMemorials({ exceptSlug }: { exceptSlug?: string }) {
  const items = await getRecentMemorials(3, exceptSlug);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
      <span className="uppercase tracking-wider">Recent memorials</span>
      {items.map((m, i) => (
        <span key={m.slug} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          <Link href={`/m/${m.slug}`} className="hover:underline" style={{ color: "var(--link)" }}>
            {m.coverMediaId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${m.coverMediaId}?v=thumb&m=${m.slug}`}
                alt=""
                className="mr-1 inline-block h-4 w-4 rounded-full object-cover align-[-2px]"
              />
            )}
            {m.name}
          </Link>
        </span>
      ))}
    </div>
  );
}
