import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ShareMode } from "@prisma/client";

import { db } from "@/lib/db";
import { getRedactedGraph, shareCookieToken } from "@/lib/share";
import { TreeExplorer } from "@/components/tree/TreeExplorer";
import { submitSharePassword } from "./actions";

const MODE_MAP: Record<ShareMode, "ancestors" | "hourglass" | "descendants"> = {
  PEDIGREE: "ancestors",
  HOURGLASS: "hourglass",
  DESCENDANTS: "descendants",
};

async function loadShare(slug: string) {
  return db.sharedView.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      mode: true,
      generations: true,
      includeLiving: true,
      revoked: true,
      expiresAt: true,
      passwordHash: true,
      centralPersonId: true,
      treeId: true,
      tree: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const share = await loadShare(slug);
  if (!share || share.revoked) return { title: "Shared family tree" };
  return {
    title: `${share.title ?? share.tree.name} — shared family tree`,
    robots: { index: false },
  };
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Build your own tree
        </Link>
      </header>
      <div className="mt-6 flex-1">{children}</div>
      <footer className="mt-8 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        A read-only family tree shared via Family Compass. Living people are redacted.
      </footer>
    </main>
  );
}

export default async function SharedViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bad?: string }>;
}) {
  const { slug } = await params;
  const { bad } = await searchParams;
  const share = await loadShare(slug);

  if (!share || share.revoked) {
    return (
      <Frame>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This shared link is no longer available.
        </p>
      </Frame>
    );
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return (
      <Frame>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This shared link has expired.
        </p>
      </Frame>
    );
  }

  // password gate
  if (share.passwordHash) {
    const jar = await cookies();
    const ok = jar.get(`fc_share_${slug}`)?.value === shareCookieToken(share.passwordHash);
    if (!ok) {
      return (
        <Frame>
          <div
            className="mx-auto max-w-sm rounded-2xl border p-6"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <h1 className="text-lg font-semibold">This tree is password-protected</h1>
            <form action={submitSharePassword.bind(null, slug)} className="mt-3 flex flex-col gap-2">
              <input
                type="password"
                name="password"
                required
                autoFocus
                placeholder="Password"
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              />
              <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                View tree
              </button>
              {bad && <p className="text-sm text-red-600">Incorrect password.</p>}
            </form>
          </div>
        </Frame>
      );
    }
  }

  // count the view (best-effort)
  db.sharedView
    .update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  const graph = await getRedactedGraph(share.treeId, {
    centralPersonId: share.centralPersonId,
    generations: share.generations,
    includeLiving: share.includeLiving,
  });

  const centerName = graph.persons[share.centralPersonId]?.name ?? "this family";

  return (
    <Frame>
      <div className="mb-4">
        <h1 className="font-serif text-2xl">{share.title ?? share.tree.name}</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Centered on {centerName}
          {share.createdBy.name ? ` · shared by ${share.createdBy.name}` : ""}
        </p>
      </div>
      <TreeExplorer
        treeId={share.treeId}
        graph={graph}
        initialCenterId={share.centralPersonId}
        homePersonId={share.centralPersonId}
        canManage={false}
        readOnly
        shareSlug={slug}
        initialMode={MODE_MAP[share.mode]}
        initialGens={share.generations}
      />
    </Frame>
  );
}
