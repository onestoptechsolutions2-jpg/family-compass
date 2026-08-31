import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";
import { formatDate } from "@/lib/date";
import { ViewBeacon } from "@/components/ViewBeacon";
import { submitClaimInvite } from "./actions";

export const metadata: Metadata = { title: "Claim your profile", robots: { index: false } };
export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  gone: "This link is not valid.",
  used: "This link has already been used or was cancelled.",
  expired: "This link has expired. Ask the family to send a new one.",
  claimed: "This profile has already been claimed.",
  deceased: "This profile can no longer be claimed.",
  name: "Please enter your name.",
  phone: "Please enter a valid WhatsApp number.",
};

export default async function ClaimInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string; err?: string }>;
}) {
  const { token } = await params;
  const { sent, err } = await searchParams;

  const invite = await db.claimInvite.findUnique({
    where: { token },
    select: {
      note: true,
      revokedAt: true,
      usedAt: true,
      expiresAt: true,
      createdBy: { select: { name: true } },
      tree: { select: { name: true } },
      person: {
        select: {
          claimedByUserId: true,
          gender: true,
          names: { select: NAME_SELECT },
          clan: { select: { name: true } },
          subClan: true,
          eventRefs: {
            where: { event: { type: { in: ["Birth", "Death", "Burial"] } } },
            select: { event: { select: { type: true, dateYear: true, dateMonth: true, dateDay: true, dateText: true, dateModifier: true, dateQuality: true, place: { select: { title: true } } } } },
          },
        },
      },
    },
  });

  if (!invite) notFound();

  const dead = invite.person.eventRefs.some((r) => r.event.type === "Death" || r.event.type === "Burial");
  const gone = !!invite.revokedAt || (!!invite.usedAt && !sent) || (!!invite.expiresAt && invite.expiresAt.getTime() < Date.now());
  const claimed = !!invite.person.claimedByUserId;
  const name = displayName(invite.person.names);
  const birth = invite.person.eventRefs.find((r) => r.event.type === "Birth")?.event;
  const surname = invite.person.names.find((n) => n.preferred)?.surname ?? "";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-10">
      <ViewBeacon kind="claim" target={token} />
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
      </header>

      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
          {invite.tree.name}
        </p>
        <h1 className="mt-1 font-serif text-2xl">Is this you?</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {invite.createdBy?.name ? `${invite.createdBy.name} ` : "A family member "}
          created this link so you can claim your own profile and keep it up to date.
        </p>
      </div>

      <div
        className="mt-5 rounded-2xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
      >
        <p className="text-lg font-semibold">{name}</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {invite.person.gender.toLowerCase()}
          {birth ? ` · born ${formatDate(birth)}` : ""}
          {birth?.place?.title ? ` in ${birth.place.title}` : ""}
          {invite.person.clan ? ` · ${invite.person.clan.name} clan` : ""}
          {invite.person.subClan ? ` (${invite.person.subClan})` : ""}
        </p>
        {invite.note && (
          <p className="mt-2 rounded-lg border p-2 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
            “{invite.note}”
          </p>
        )}
      </div>

      {sent ? (
        <p className="mt-6 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--success)" }}>
          Thank you. The family has been notified and will confirm it&apos;s you, then link your
          account. You can close this page.
        </p>
      ) : claimed ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>{ERR.claimed}</p>
      ) : dead ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>{ERR.deceased}</p>
      ) : gone ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>{ERR[invite.revokedAt ? "used" : "expired"]}</p>
      ) : (
        <form action={submitClaimInvite.bind(null, token)} className="mt-6 flex flex-col gap-3">
          {err && ERR[err] && <p className="text-sm" style={{ color: "var(--danger)" }}>{ERR[err]}</p>}
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Your name</span>
            <input
              name="name"
              required
              placeholder={`e.g. ${surname ? "First " + surname : "your full name"}`}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Your WhatsApp number</span>
            <input
              name="phone"
              required
              inputMode="tel"
              placeholder="+2547…"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Anything to tell the family? (optional)</span>
            <textarea
              name="note"
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            />
          </label>
          <button className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Yes, this is me
          </button>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            The family confirms every claim before an account is linked.
          </p>
        </form>
      )}

      <footer className="mt-auto pt-10 text-xs" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:underline">About Family Compass</Link>
      </footer>
    </main>
  );
}
