import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";
import { getSessionUser } from "@/lib/rbac";
import { connectAsMe, connectAsNew } from "./actions";

export const metadata: Metadata = { title: "A friend invited you", robots: { index: false } };
export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  form: "Enter your name and a valid WhatsApp number.",
  exists: "That number already has a Family Compass account — sign in first, then open this link again.",
  signin: "Please sign in and open the link again.",
  "This link is not valid": "This link is not valid.",
  "This link has already been used": "This link has already been used.",
  "This link has expired": "This link has expired. Ask your friend to send a new one.",
};

export default async function FriendInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { token } = await params;
  const { err } = await searchParams;
  const me = await getSessionUser();

  const invite = await db.friendInvite.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      inviteeName: true,
      roleHint: true,
      originText: true,
      inviter: { select: { name: true } },
      fromTree: { select: { name: true } },
      fromPerson: { select: { names: { select: NAME_SELECT } } },
    },
  });
  if (!invite) notFound();

  const gone =
    invite.status !== "PENDING" ||
    (invite.expiresAt != null && invite.expiresAt.getTime() < Date.now());
  const inviterName = invite.inviter.name || displayName(invite.fromPerson.names) || "A friend";
  const errMsg = err ? (ERR[err] ?? decodeURIComponent(err)) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-10">
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
      </header>

      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
          {inviterName} invited you
        </p>
        <h1 className="mt-1 font-serif text-2xl">Map your own family</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {inviterName} put you in their circle as a {invite.roleHint.replace(/-/g, " ")}. Start your
          own family tree — it opens centred on you — and the two of you stay connected across
          families. You keep full control of your tree; {inviterName} can&apos;t see into it.
        </p>
        {invite.originText && (
          <p className="mt-3 rounded-lg border p-2 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
            “{invite.originText}”
          </p>
        )}
      </div>

      {errMsg && (
        <p className="mt-5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {errMsg}
        </p>
      )}

      {gone ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          {invite.status === "ACCEPTED" ? "This invite has already been accepted." : "This link is no longer available."}
        </p>
      ) : me ? (
        <form action={connectAsMe.bind(null, token)} className="mt-6">
          <button className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Connect with {inviterName}
          </button>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Using your existing account. If you don&apos;t have a tree yet, one is created for you.
          </p>
        </form>
      ) : (
        <form action={connectAsNew.bind(null, token)} className="mt-6 flex flex-col gap-3">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Your name</span>
            <input
              name="name"
              required
              defaultValue={invite.inviteeName}
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
          <button className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Start my tree &amp; connect
          </button>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            No email or password. We create a tree centred on you; explore from there.
          </p>
        </form>
      )}

      <footer className="mt-auto pt-10 text-xs" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:underline">About Family Compass</Link>
      </footer>
    </main>
  );
}
