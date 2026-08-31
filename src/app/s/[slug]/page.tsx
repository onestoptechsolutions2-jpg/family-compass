import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ShareMode } from "@prisma/client";

import { db } from "@/lib/db";
import { getRedactedGraph, shareCookieToken } from "@/lib/share";
import { isProfileClaimable } from "@/lib/claim-eligibility";
import { getSharedCentralProfile } from "@/lib/queries/shared-profile";
import { TreeExplorer } from "@/components/tree/TreeExplorer";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { Section } from "@/components/profile/Section";
import { ConnectionGrid, type Connection } from "@/components/profile/ConnectionGrid";
import { MediaThumb } from "@/components/media/MediaThumb";
import { ViewBeacon } from "@/components/ViewBeacon";
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
      allowClaims: true,
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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6">
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
        A read-only family profile shared via Family Compass. Living people are redacted.
      </footer>
    </main>
  );
}

const yearsOf = (p?: { birthYear: number | null; deathYear: number | null; living: boolean }) =>
  p && (p.birthYear || p.deathYear)
    ? `${p.birthYear ?? "?"}–${p.deathYear ?? (p.living ? "" : "?")}`
    : null;

export default async function SharedViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bad?: string; p?: string }>;
}) {
  const { slug } = await params;
  const { bad, p: pParam } = await searchParams;
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
            style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
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
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              />
              <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                View profile
              </button>
              {bad && <p className="text-sm" style={{ color: "var(--danger)" }}>Incorrect password.</p>}
            </form>
          </div>
        </Frame>
      );
    }
  }

  db.sharedView
    .update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  const graph = await getRedactedGraph(share.treeId, {
    centralPersonId: share.centralPersonId,
    generations: share.generations,
    includeLiving: share.includeLiving,
  });

  // Which person is the profile subject? The share's central person by default;
  // a ?p= override is honoured only if that person is visible in this share.
  const subjectId =
    pParam && graph.persons[pParam] ? pParam : share.centralPersonId;

  const profile = await getSharedCentralProfile(share.treeId, subjectId, {
    includeLiving: share.includeLiving,
  });

  const gp = graph.persons[subjectId];
  const linkTo = (id: string) => `/s/${slug}?p=${id}`;

  const build = (ids: string[] | undefined, relation: string): Connection[] =>
    [...new Set(ids ?? [])]
      .map((id) => graph.persons[id])
      .filter(Boolean)
      .map((rp) => ({
        id: rp!.id,
        name: rp!.name,
        gender: rp!.gender,
        relation,
        detail: yearsOf(rp!),
        href: linkTo(rp!.id),
        redacted: rp!.name.startsWith("Living "),
        deceased: rp!.deceased,
      }));

  const parentIds = graph.up[subjectId] ?? [];
  const childIds = graph.down[subjectId] ?? [];
  const spouseIds = graph.spouses[subjectId] ?? [];
  const siblingIds = [...new Set(parentIds.flatMap((par) => graph.down[par] ?? []))].filter(
    (id) => id !== subjectId,
  );

  const connections: Connection[] = [
    ...build(parentIds, "Parent"),
    ...build(spouseIds, "Spouse"),
    ...build(childIds, "Child"),
    ...build(siblingIds, "Sibling"),
  ];

  const displayName = profile && !profile.redacted ? profile.name : gp?.name ?? "This person";
  const isSubjectCentral = subjectId === share.centralPersonId;

  return (
    <Frame>
      <ViewBeacon kind="share" target={slug} />
      {!isSubjectCentral && (
        <Link
          href={`/s/${slug}`}
          className="mb-3 inline-block text-sm hover:underline"
          style={{ color: "var(--link)" }}
        >
          ← Back to {graph.persons[share.centralPersonId]?.name ?? "the shared profile"}
        </Link>
      )}

      <div className="flex flex-col gap-4">
        <ProfileHero
          name={displayName}
          gender={gp?.gender}
          headline={profile && !profile.redacted ? profile.headline || null : null}
          photoId={profile && !profile.redacted ? profile.photos[0]?.id ?? null : null}
          photoMime={profile && !profile.redacted ? profile.photos[0]?.mimeType ?? null : null}
          share={slug}
          primaryLine={
            profile && !profile.redacted
              ? [profile.bornLine && `Born ${profile.bornLine}`, profile.diedLine && `Died ${profile.diedLine}`]
                  .filter(Boolean)
                  .join("   ·   ") || null
              : "Details hidden to protect a living relative."
          }
          secondaryLine={
            profile && !profile.redacted && profile.restingPlace
              ? `Rests at ${profile.restingPlace}`
              : null
          }
          badges={
            profile && !profile.redacted
              ? ([profile.clan && `${profile.clan} clan`, profile.subClan, profile.community].filter(
                  Boolean,
                ) as string[])
              : []
          }
          actions={
            <>
              {profile && !profile.redacted && profile.memorialSlug && (
                <Link
                  href={`/m/${profile.memorialSlug}`}
                  className="rounded-full border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  View memorial
                </Link>
              )}
              {share.allowClaims &&
                isProfileClaimable({ deceased: gp?.deceased, redactedName: displayName }) && (
                <Link
                  href={`/s/${slug}/claim/${subjectId}`}
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  This is me
                </Link>
              )}
            </>
          }
        />

        {share.allowClaims && (
          <p
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <strong>Are you in this family?</strong> Open your own profile and tap{" "}
            <em>“This is me”</em>, or{" "}
            <Link href={`/s/${slug}/join`} style={{ color: "var(--link)" }} className="hover:underline">
              ask to be added
            </Link>
            .
          </p>
        )}

        {profile && !profile.redacted && profile.about && (
          <Section title="About" eyebrow="Life">
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{profile.about}</p>
          </Section>
        )}

        {profile && !profile.redacted && profile.events.length > 0 && (
          <Section title="Life events" eyebrow="Timeline">
            <ol className="flex flex-col gap-3">
              {profile.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {e.type}
                      {e.date ? (
                        <span style={{ color: "var(--muted)" }}> · {e.date}</span>
                      ) : null}
                    </p>
                    {(e.place || e.note) && (
                      <p className="text-sm" style={{ color: "var(--muted)" }}>
                        {[e.place, e.note].filter(Boolean).join(" — ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <Section title="Family" eyebrow="Connections">
          <ConnectionGrid people={connections} />
        </Section>

        {profile && !profile.redacted && profile.photos.length > 0 && (
          <Section title="Photos" eyebrow="Featured">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {profile.photos.map((ph) => (
                <div
                  key={ph.id}
                  className="aspect-square overflow-hidden rounded-xl border"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <MediaThumb mediaId={ph.id} mimeType={ph.mimeType} alt="" share={slug} />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section
          title="Family tree"
          eyebrow="Explore"
          action={
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {graph.total} people
            </span>
          }
        >
          <TreeExplorer
            treeId={share.treeId}
            graph={graph}
            initialCenterId={subjectId}
            homePersonId={share.centralPersonId}
            canManage={false}
            readOnly
            shareSlug={slug}
            allowClaims={share.allowClaims}
            initialMode={MODE_MAP[share.mode]}
            initialGens={share.generations}
          />
        </Section>

        <section
          className="rounded-2xl border p-6 text-center"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(120deg, var(--accent-soft), color-mix(in srgb, var(--accent-soft) 40%, var(--surface)))",
          }}
        >
          <h2 className="font-serif text-lg">Start your own family record</h2>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: "var(--muted)" }}>
            Add yourself, then your parents and children. Record your clan and the village you come
            from. Free to build and share.
          </p>
          <Link
            href="/start"
            className="mt-3 inline-block rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
        </section>
      </div>
    </Frame>
  );
}
