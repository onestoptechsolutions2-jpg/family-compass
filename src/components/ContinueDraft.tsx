"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Someone who started a design here earlier, on this phone, is offered to carry on.
 * The browser remembers the private link; the server says whether it is still open.
 */
export function ContinueDraft({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const t = localStorage.getItem(`fc:draft:${slug}`);
        if (!t) return;
        const r = await fetch(`/api/draft/${encodeURIComponent(t)}`);
        const j = (await r.json()) as { ok?: boolean };
        if (live && j.ok) setToken(t);
        else if (live && r.status !== 429) localStorage.removeItem(`fc:draft:${slug}`); // finished or gone
      } catch {
        /* no storage or no network: just no offer */
      }
    })();
    return () => {
      live = false;
    };
  }, [slug]);

  if (!token) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}>
      <span>You have a design in progress for this piece.</span>
      <Link href={`/order/${token}?step=1`} className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
        Continue your design
      </Link>
    </div>
  );
}
