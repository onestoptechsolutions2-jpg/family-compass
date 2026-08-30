import Link from "next/link";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { acceptInvite } from "./actions";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await db.invitation.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      workspace: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-lg font-semibold">
        🧭 Family Compass
      </Link>
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        {body}
      </div>
    </main>
  );

  if (!invite) {
    return shell(<p className="text-sm">This invitation link is not valid.</p>);
  }
  if (invite.acceptedAt) {
    return shell(<p className="text-sm">This invitation has already been used.</p>);
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return shell(<p className="text-sm">This invitation has expired. Ask for a new one.</p>);
  }

  const user = await getSessionUser();
  const inviter = invite.invitedBy.name ?? invite.invitedBy.email;

  return shell(
    <>
      <h1 className="text-xl font-semibold">You&apos;re invited</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        <strong>{inviter}</strong> invited <strong>{invite.email}</strong> to join the{" "}
        <strong>{invite.workspace.name}</strong> workspace as{" "}
        <strong>{invite.role.toLowerCase()}</strong>.
      </p>

      {!user ? (
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
          className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign in as {invite.email} to accept
        </Link>
      ) : user.email.toLowerCase() !== invite.email.toLowerCase() ? (
        <p className="mt-5 text-sm text-red-600">
          You&apos;re signed in as {user.email}. Sign in as {invite.email} to accept this
          invitation.
        </p>
      ) : (
        <form action={acceptInvite.bind(null, token)} className="mt-5">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Accept invitation
          </button>
        </form>
      )}
    </>,
  );
}
