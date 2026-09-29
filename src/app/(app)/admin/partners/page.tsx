import { PartnerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { requirePlatformAdmin } from "@/lib/rbac";
import { SKILLS, skillLabel } from "@/lib/jobs";
import { invitePartner, setPartnerStatus, updatePartner } from "./actions";

export const metadata = { title: "Partners" };
export const dynamic = "force-dynamic";

const field = "rounded-lg border px-3 py-1.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;
const card = "rounded-xl border p-4 text-sm";
const cardStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;
const btn = "rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700";

function Skills({ checked }: { checked: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {Object.entries(SKILLS).map(([k, label]) => (
        <label key={k} className="flex items-center gap-1.5">
          <input type="checkbox" name="skills" value={k} defaultChecked={checked.includes(k)} /> {label}
        </label>
      ))}
    </div>
  );
}

export default async function AdminPartnersPage() {
  await requirePlatformAdmin();
  const origin = await publicOrigin();
  const partners = await db.partner.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      invites: { where: { acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 1 },
      members: { select: { id: true } },
      jobs: { select: { status: true } },
    },
  });
  const applied = partners.filter((p) => p.status === PartnerStatus.APPLIED);
  const rest = partners.filter((p) => p.status !== PartnerStatus.APPLIED);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Partners</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Partners make and ship what customers order. Each has specialities; only partners with the right one can be asked to quote.
      </p>

      {applied.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Applications to review</h2>
          {applied.map((p) => (
            <div key={p.id} className={card} style={cardStyle}>
              <div className="font-medium">{p.name}</div>
              <div style={{ color: "var(--muted)" }}>
                {p.phone ?? "no phone"} · {p.email ?? "no email"} · {p.regions.join(", ") || "no regions"}
              </div>
              <div className="mt-1">{p.skills.map(skillLabel).join(", ") || "no specialities"}</div>
              {p.notes && <p className="mt-1" style={{ color: "var(--muted)" }}>{p.notes}</p>}
              <div className="mt-2 flex gap-2">
                <form action={setPartnerStatus.bind(null, p.id, PartnerStatus.ACTIVE)}><button className={btn}>Approve</button></form>
                <form action={setPartnerStatus.bind(null, p.id, PartnerStatus.REJECTED)}><button className="rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>Decline</button></form>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className={card} style={cardStyle}>
        <h2 className="font-medium">Invite a partner</h2>
        <form action={invitePartner} className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <input name="name" required placeholder="Business name" className={field} style={fieldStyle} />
            <input name="email" type="email" required placeholder="Their Google email" className={field} style={fieldStyle} />
            <input name="phone" placeholder="Phone" className={field} style={fieldStyle} />
            <input name="regions" placeholder="Regions, comma separated" className={field} style={fieldStyle} />
          </div>
          <Skills checked={[]} />
          <div><button className={btn}>Create and get invite link</button></div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">All partners</h2>
        {rest.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No partners yet.</p>}
        {rest.map((p) => (
          <div key={p.id} className={card} style={cardStyle}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs uppercase" style={{ color: "var(--muted)" }}>{p.status.toLowerCase()}</span>
              <span style={{ color: "var(--muted)" }}>
                {p.members.length ? `${p.members.length} signed in` : "not signed in yet"} · {p.jobs.length} jobs
              </span>
            </div>
            {p.invites[0] && (
              <div className="mt-1 break-all font-mono text-xs">
                Invite link: {origin}/partner/join/{p.invites[0].token}
              </div>
            )}
            <form action={updatePartner.bind(null, p.id)} className="mt-2 flex flex-col gap-2">
              <Skills checked={p.skills} />
              <div className="flex flex-wrap gap-2">
                <input name="regions" defaultValue={p.regions.join(", ")} placeholder="Regions" className={field} style={fieldStyle} />
                <input name="phone" defaultValue={p.phone ?? ""} placeholder="Phone" className={field} style={fieldStyle} />
                <button className={btn}>Save</button>
              </div>
            </form>
            <div className="mt-2 flex gap-3 text-xs">
              {p.status === PartnerStatus.ACTIVE ? (
                <form action={setPartnerStatus.bind(null, p.id, PartnerStatus.SUSPENDED)}><button className="underline">Suspend</button></form>
              ) : (
                <form action={setPartnerStatus.bind(null, p.id, PartnerStatus.ACTIVE)}><button className="underline">Make active</button></form>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
