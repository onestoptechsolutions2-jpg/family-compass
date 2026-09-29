import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { acceptPartnerInvite } from "../../actions";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/partner/join/${token}`)}`);

  const invite = await db.partnerInvite.findUnique({ where: { token }, include: { partner: { select: { name: true } } } });
  const valid = invite && !invite.acceptedAt && invite.expiresAt.getTime() > Date.now();

  return (
    <div className="rounded-xl border p-5 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <h1 className="text-lg font-semibold">Join as a partner</h1>
      {error && <p className="mt-3 text-red-600">{error}</p>}
      {valid ? (
        <>
          <p className="mt-2" style={{ color: "var(--muted)" }}>
            You were invited to make products for <strong>{invite.partner.name}</strong>. Signed in as {user.email}.
          </p>
          <form action={acceptPartnerInvite.bind(null, token)} className="mt-4">
            <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Accept and open my portal</button>
          </form>
        </>
      ) : (
        <p className="mt-2" style={{ color: "var(--muted)" }}>This invite link is not valid or has expired. Ask us for a new one.</p>
      )}
    </div>
  );
}
