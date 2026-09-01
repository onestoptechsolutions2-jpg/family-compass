import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getPaymentSettings } from "@/lib/payments";
import { DeepSearchDialog } from "@/components/DeepSearchDialog";

export const metadata = { title: "Deep search" };

export default async function DiscoverPage() {
  const me = await requireUser();
  const settings = await getPaymentSettings();

  const mine = await db.deepSearch.findMany({
    where: { requesterId: me.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, query: true, resultCount: true, status: true, createdAt: true },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Deep search across families</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Check whether someone is from your bloodline or clan — across every family tree whose
          owner joined the research directory. The preview shows who might match; unlock the full
          records and the families&apos; contacts for {settings.currency}{" "}
          {settings.deepSearchPriceKes.toLocaleString()}.
        </p>
        <div className="mt-3">
          <DeepSearchDialog
            label="Start a deep search"
            buttonClass="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          />
        </div>
      </div>

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
