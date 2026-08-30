import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext, canEdit, canManageTree } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { getMemorialForEditor, type ProgramItem } from "@/lib/queries/memorial";
import { sectionLabel } from "@/lib/memorial-sections";
import { MEMORIAL_TEMPLATES } from "@/lib/memorial-templates";
import { personMedia } from "@/lib/queries/media";
import { MediaThumb } from "@/components/media/MediaThumb";
import { CopyButton } from "@/components/CopyButton";
import { QrShare } from "@/components/QrShare";
import {
  createMemorial,
  updateMemorial,
  setMemorialCover,
  saveProgram,
  moderateGuestbook,
  deleteMemorial,
  draftEulogy,
  inviteContributor,
  removeContributor,
  reviewContribution,
  setMemorialStatus,
  setMemorialTemplate,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  FINAL: "Final · locked",
};

export const metadata = { title: "Memorial" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function MemorialEditorPage({
  params,
}: {
  params: Promise<{ treeId: string; personId: string }>;
}) {
  const { treeId, personId } = await params;
  const ctx = await loadTreeContext(treeId);
  if (!canEdit(ctx.role)) notFound();
  const style = { borderColor: "var(--border)", background: "var(--bg)" };

  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      names: {
        select: {
          first: true,
          surname: true,
          surnamePrefix: true,
          suffix: true,
          nick: true,
          title: true,
          preferred: true,
          type: true,
          order: true,
        },
      },
    },
  });
  if (!person) notFound();
  const name = displayName(person.names);

  const memorial = await getMemorialForEditor(treeId, personId);

  if (!memorial) {
    return (
      <div className="max-w-md">
        <Link href={`/trees/${treeId}/people/${personId}`} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
          ← {name}
        </Link>
        <h1 className="mt-2 text-lg font-semibold">Memorial page</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Create a tribute page for {name}: a eulogy, a funeral program, a shareable link, and a
          guestbook for condolences.
        </p>
        <form action={createMemorial.bind(null, treeId, personId)} className="mt-4">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Open a memorial
          </button>
        </form>
      </div>
    );
  }

  const media = await personMedia(treeId, personId);
  const order = ((memorial.program?.order as ProgramItem[]) ?? []).concat([{ title: "", detail: "" }]);
  const origin = await publicOrigin();
  const url = `${origin}/m/${memorial.slug}`;
  const pending = memorial.guestbook.filter((g) => g.status === "PENDING");

  const locked = memorial.status === "FINAL";
  const canManage = canManageTree(ctx.role);
  const submitted = memorial.contributions.filter((c) => c.status === "SUBMITTED");
  const reviewed = memorial.contributions.filter((c) => c.status !== "SUBMITTED");
  const contributeLink = (token: string) => `${origin}/m/${memorial.slug}/contribute/${token}`;
  const waLink = (phone: string | null, token: string) => {
    const digits = (phone ?? "").replace(/\D/g, "");
    const text = encodeURIComponent(
      `Please help with ${name}'s memorial — add a memory or tribute here: ${contributeLink(token)}`,
    );
    return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/trees/${treeId}/people/${personId}`} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
            ← {name}
          </Link>
          <h1 className="text-lg font-semibold">Memorial — {name}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
            {memorial.published ? "View public page" : "Preview"}
          </a>
          <span style={{ color: "var(--muted)" }}>{memorial.viewCount} views</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-black/5 px-2 py-1 text-xs">{url}</code>
        <CopyButton value={url} label="Copy link" />
        <QrShare
          value={url}
          title={`QR — ${name}'s memorial`}
          label="Show QR"
          caption="Point a phone camera here to open the memorial."
          buttonClass="rounded-lg border px-3 py-1 text-xs font-medium"
        />
      </div>

      {/* ---- Workflow ---- */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            background: locked ? "var(--accent-soft)" : "var(--surface-2)",
            color: locked ? "var(--accent)" : "var(--muted)",
          }}
        >
          {STATUS_LABEL[memorial.status]}
        </span>

        {memorial.status === "DRAFT" && (
          <form action={setMemorialStatus.bind(null, treeId, memorial.id, "IN_REVIEW")}>
            <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
              Move to review
            </button>
          </form>
        )}
        {memorial.status === "IN_REVIEW" && (
          <>
            <form action={setMemorialStatus.bind(null, treeId, memorial.id, "DRAFT")}>
              <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                Back to draft
              </button>
            </form>
            <form action={setMemorialStatus.bind(null, treeId, memorial.id, "FINAL")}>
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Finalise &amp; lock
              </button>
            </form>
          </>
        )}
        {locked && (
          <>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Locked{memorial.lockedAt ? ` ${memorial.lockedAt.toISOString().slice(0, 10)}` : ""}
              {memorial.lockedBy?.name ? ` by ${memorial.lockedBy.name}` : ""}
            </span>
            {canManage ? (
              <form action={setMemorialStatus.bind(null, treeId, memorial.id, "IN_REVIEW")}>
                <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                  Unlock for editing
                </button>
              </form>
            ) : (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Ask a tree manager to unlock it to make changes.
              </span>
            )}
          </>
        )}
      </div>

      {locked && (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          This is the final, locked copy. Tribute, cover and programme editing are disabled until a
          tree manager unlocks it.
        </p>
      )}

      {/* ---- Template ---- */}
      <form
        action={setMemorialTemplate.bind(null, treeId, memorial.id)}
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Page style</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          How the public memorial looks. Change any time — even after locking.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MEMORIAL_TEMPLATES.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer gap-2 rounded-lg border p-3 text-sm"
              style={{
                borderColor: memorial.template === t.id ? "var(--color-brand-600)" : "var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <input type="radio" name="template" value={t.id} defaultChecked={memorial.template === t.id} className="mt-0.5" />
              <span>
                <span className="font-medium">{t.label}</span>
                <span className="block text-xs" style={{ color: "var(--muted)" }}>{t.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <button className="mt-3 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
          Apply style
        </button>
      </form>

      <fieldset disabled={locked} className="contents">

      {/* ---- Tribute ---- */}
      <form
        action={updateMemorial.bind(null, treeId, memorial.id)}
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Tribute</h2>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Headline</span>
          <input name="headline" defaultValue={memorial.headline ?? ""} className={field} style={style} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Born</span>
            <input name="bornText" defaultValue={memorial.bornText ?? ""} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Died</span>
            <input name="diedText" defaultValue={memorial.diedText ?? ""} className={field} style={style} />
          </label>
        </div>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Resting place</span>
          <input name="restingPlace" defaultValue={memorial.restingPlace ?? ""} className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Eulogy</span>
          <textarea name="eulogy" rows={12} defaultValue={memorial.eulogy ?? ""} className={field} style={style} />
        </label>
        <p className="-mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Draft generated from tree records. Edit freely, fill the <code>[bracketed]</code> prompts,
          then Save. Use the buttons below to regenerate.
        </p>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Service details (times, directions)</span>
          <textarea name="serviceText" rows={3} defaultValue={memorial.serviceText ?? ""} className={field} style={style} />
        </label>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" value="true" defaultChecked={memorial.published} /> Published (link is live)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="includeLiving" value="true" defaultChecked={memorial.includeLiving} /> Show living relatives by name
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="guestbookOpen" value="true" defaultChecked={memorial.guestbookOpen} /> Guestbook open
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="guestbookModerated" value="true" defaultChecked={memorial.guestbookModerated} /> Approve entries before they show
          </label>
        </div>
        <div>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save tribute
          </button>
        </div>
      </form>

      <div className="-mt-2 flex flex-wrap gap-2 text-sm">
        <form action={draftEulogy.bind(null, treeId, memorial.id)}>
          <input type="hidden" name="overwrite" value="0" />
          <button className="rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
            Append draft from records
          </button>
        </form>
        <form action={draftEulogy.bind(null, treeId, memorial.id)}>
          <input type="hidden" name="overwrite" value="1" />
          <button className="rounded-lg border px-3 py-1.5 text-red-600" style={{ borderColor: "var(--border)" }}>
            Replace with fresh draft
          </button>
        </form>
      </div>

      {/* ---- Cover photo ---- */}
      {media.length > 0 && (
        <form
          action={setMemorialCover.bind(null, treeId, memorial.id)}
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <h2 className="font-medium">Cover photo</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex flex-col items-center gap-1 text-xs">
              <input type="radio" name="coverMediaId" value="" defaultChecked={!memorial.coverMediaId} />
              none
            </label>
            {media.map((r) => (
              <label key={r.id} className="flex flex-col items-center gap-1 text-xs">
                <div className="h-16 w-16 overflow-hidden rounded border" style={{ borderColor: "var(--border)" }}>
                  <MediaThumb mediaId={r.media.id} mimeType={r.media.mimeType} alt="" />
                </div>
                <input
                  type="radio"
                  name="coverMediaId"
                  value={r.media.id}
                  defaultChecked={memorial.coverMediaId === r.media.id}
                />
              </label>
            ))}
          </div>
          <button className="mt-3 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            Set cover
          </button>
        </form>
      )}

      {/* ---- Funeral program (audited) ---- */}
      <form
        action={saveProgram.bind(null, treeId, memorial.id)}
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Funeral program</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Every save is recorded. {memorial.program?.updatedAt ? (
            <>Last edited {memorial.program.updatedAt.toISOString().slice(0, 16).replace("T", " ")} by{" "}
              {memorial.program.updatedBy?.name ?? memorial.program.updatedBy?.email ?? "someone"}.</>
          ) : null}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Venue</span>
            <input name="venue" defaultValue={memorial.program?.venue ?? ""} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Service date</span>
            <input
              type="date"
              name="serviceDate"
              defaultValue={memorial.program?.serviceDate?.toISOString().slice(0, 10) ?? ""}
              className={field}
              style={style}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span style={{ color: "var(--muted)" }}>Committee / contacts</span>
          <textarea name="committee" rows={2} defaultValue={memorial.program?.committee ?? ""} className={field} style={style} />
        </label>

        <div className="mt-3 text-sm font-medium">Order of service</div>
        {order.map((it, i) => (
          <div key={i} className="mt-2 grid grid-cols-[1fr,1fr] gap-2">
            <input name="itemTitle" defaultValue={it.title} placeholder="Item" className="rounded-lg border px-3 py-2 text-sm" style={style} />
            <input name="itemDetail" defaultValue={it.detail} placeholder="Who / note" className="rounded-lg border px-3 py-2 text-sm" style={style} />
          </div>
        ))}
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Fill the blank row to add an item; clear a row to remove it.
        </p>
        <label className="mt-3 block text-sm">
          <span style={{ color: "var(--muted)" }}>Change note (for the audit log)</span>
          <input name="note" className={field} style={style} />
        </label>
        <button className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save program
        </button>

        {memorial.program?.revisions?.length ? (
          <div className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
            <div className="font-medium">Revision history</div>
            <ul className="mt-1 space-y-0.5">
              {memorial.program.revisions.map((r) => (
                <li key={r.id}>
                  {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  {r.editedBy?.name ?? r.editedBy?.email ?? "someone"}
                  {r.note ? ` — ${r.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      </fieldset>

      {/* ---- Collaboration ---- */}
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Collaborators</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Invite relatives to send memories and tributes. Share the WhatsApp link from your own
          phone. You review every contribution before it appears.
        </p>

        {memorial.contributors.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {memorial.contributors.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5"
                style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}
              >
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.relation ? <span style={{ color: "var(--muted)" }}> · {c.relation}</span> : null}
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {c.lastSeenAt ? `opened ${c.lastSeenAt.toISOString().slice(0, 10)}` : "not opened yet"}
                    {" · "}
                    {c._count.contributions} contribution{c._count.contributions === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={waLink(c.phone, c.token)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-white"
                    style={{ background: "#25D366" }}
                  >
                    WhatsApp
                  </a>
                  <CopyButton value={contributeLink(c.token)} label="Copy link" />
                  <QrShare
                    value={contributeLink(c.token)}
                    title={`QR for ${c.name}`}
                    label="QR"
                    caption={`${c.name} can scan this to add a memory for ${name}.`}
                    buttonClass="rounded-md border px-2 py-1 text-xs"
                  />
                  <form action={removeContributor.bind(null, treeId, memorial.id, c.id)}>
                    <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
                      remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={inviteContributor.bind(null, treeId, memorial.id)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2 text-sm" style={style} />
          <input name="phone" placeholder="Phone (for WhatsApp)" className="rounded-lg border px-3 py-2 text-sm" style={style} />
          <input name="relation" placeholder="Relation" className="rounded-lg border px-3 py-2 text-sm sm:hidden" style={style} />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Add
          </button>
        </form>
      </section>

      {/* ---- Contributions inbox ---- */}
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">
          Contributions
          {submitted.length > 0 && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {submitted.length} to review
            </span>
          )}
        </h2>

        {memorial.contributions.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Nothing submitted yet.</p>
        )}

        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {submitted.map((c) => (
            <li key={c.id} className="rounded-lg border p-3" style={{ borderColor: "var(--accent)", background: "var(--surface-2)" }}>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {c.authorName}
                  <span style={{ color: "var(--muted)" }}> · {sectionLabel(c.section)}</span>
                </span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {c.createdAt.toISOString().slice(0, 10)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              <div className="mt-2 flex gap-2 text-xs">
                <form action={reviewContribution.bind(null, treeId, memorial.id, c.id, "ACCEPTED")}>
                  <button
                    disabled={locked}
                    className="rounded-md bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    Accept &amp; merge
                  </button>
                </form>
                <form action={reviewContribution.bind(null, treeId, memorial.id, c.id, "DECLINED")}>
                  <button className="rounded-md border px-3 py-1" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
                    Decline
                  </button>
                </form>
              </div>
            </li>
          ))}
          {reviewed.map((c) => (
            <li key={c.id} className="rounded-lg border p-2.5" style={{ borderColor: "var(--hairline)" }}>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
                <span>
                  {c.authorName} · {sectionLabel(c.section)}
                </span>
                <span style={{ color: c.status === "ACCEPTED" ? "var(--success)" : "var(--danger)" }}>
                  {c.status.toLowerCase()}
                  {c.reviewedBy?.name ? ` by ${c.reviewedBy.name}` : ""}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Guestbook ---- */}
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Guestbook ({memorial.guestbook.length})</h2>
        {pending.length > 0 && (
          <p className="mt-1 text-sm text-amber-600">{pending.length} awaiting approval</p>
        )}
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {memorial.guestbook.map((g) => (
            <li key={g.id} className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {g.name}
                  {g.relation ? <span style={{ color: "var(--muted)" }}> · {g.relation}</span> : null}
                </span>
                <span style={{ color: "var(--muted)" }}>{g.status.toLowerCase()}</span>
              </div>
              <p className="whitespace-pre-wrap">{g.message}</p>
              <div className="mt-1 flex gap-2 text-xs">
                {g.status !== "APPROVED" && (
                  <form action={moderateGuestbook.bind(null, treeId, memorial.id, g.id, "APPROVED")}>
                    <button className="text-brand-600 hover:underline">approve</button>
                  </form>
                )}
                {g.status !== "HIDDEN" && (
                  <form action={moderateGuestbook.bind(null, treeId, memorial.id, g.id, "HIDDEN")}>
                    <button className="text-red-600 hover:underline">hide</button>
                  </form>
                )}
              </div>
            </li>
          ))}
          {memorial.guestbook.length === 0 && (
            <li style={{ color: "var(--muted)" }}>No entries yet.</li>
          )}
        </ul>
      </section>

      <form action={deleteMemorial.bind(null, treeId, memorial.id)}>
        <button className="text-xs text-red-600 hover:underline">Delete this memorial</button>
      </form>
    </div>
  );
}
