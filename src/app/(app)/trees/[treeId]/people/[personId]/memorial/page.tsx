import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext, canEdit, canManageTree } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { getMemorialForEditor, normaliseOrder, groupByDay } from "@/lib/queries/memorial";
import { formatDate } from "@/lib/date";
import { viewSummary } from "@/lib/queries/view-analytics";
import { chamaEnabled } from "@/lib/chama/plugin";
import { sectionLabel } from "@/lib/memorial-sections";
import { MEMORIAL_TEMPLATES } from "@/lib/memorial-templates";
import { PROGRAMME_TEMPLATES } from "@/lib/programme-templates";
import { flowerEmoji } from "@/lib/memorial-flowers";
import { moderateFlower, moderateReply } from "@/app/m/[slug]/actions";
import { mapsHref } from "@/lib/geo";
import { BIO_FIELDS, type BioNotes } from "@/lib/eulogy";
import { personMedia } from "@/lib/queries/media";
import { MediaThumb } from "@/components/media/MediaThumb";
import { CopyButton } from "@/components/CopyButton";
import { QrShare } from "@/components/QrShare";
import { Dialog } from "@/components/Dialog";
import { Tabs } from "@/components/Tabs";
import {
  createMemorial,
  updateMemorial,
  setMemorialCover,
  saveProgram,
  addProgramItem,
  updateProgramItem,
  removeProgramItem,
  moveProgramItem,
  moderateGuestbook,
  deleteMemorial,
  draftEulogy,
  applyProgrammeTemplate,
  saveBioNotes,
  inviteContributor,
  removeContributor,
  createGroupContribLink,
  revokeGroupContribLink,
  reviewContribution,
  setMemorialStatus,
  setMemorialTemplate,
  openMemorialFund,
  confirmFundContribution,
  voidFundContribution,
  setMemorialFundOpen,
} from "./actions";

const KES = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

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
  const burialEv = await db.eventRef.findFirst({
    where: { personId, event: { type: "Burial" } },
    select: {
      event: {
        select: {
          dateModifier: true, dateQuality: true, dateYear: true, dateMonth: true, dateDay: true,
          dateYear2: true, dateMonth2: true, dateDay2: true, dateText: true,
        },
      },
    },
  });
  const burialDateValue = burialEv ? formatDate(burialEv.event) : "";
  const reach = await viewSummary("memorial", memorial.slug);
  const order = normaliseOrder(memorial.program?.order);
  const orderDays = groupByDay(order);
  const bio = (memorial.bioNotes ?? {}) as BioNotes;
  const venueLoc =
    memorial.program?.venueMapUrl ??
    (memorial.program?.venueLat != null && memorial.program?.venueLng != null
      ? `${memorial.program.venueLat},${memorial.program.venueLng}`
      : "");
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
          <span style={{ color: "var(--muted)" }}>
            {memorial.viewCount} views
            {reach.total > 0 && (
              <>
                {" · "}
                {reach.uniques} visitors (30d)
                {reach.byRegion[0] ? ` · mostly ${reach.byRegion[0].label}` : ""}
              </>
            )}
          </span>
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

      <Tabs
        items={[
          {
            id: "content",
            label: "Content",
            panel: (
              <>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Resting place</span>
            <input name="restingPlace" defaultValue={memorial.restingPlace ?? ""} className={field} style={style} list="ke-loc" />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Burial date</span>
            <input name="burialDate" defaultValue={burialDateValue} placeholder="Sat 13 Sep 2025 · about 2025" className={field} style={style} />
          </label>
        </div>
        <p className="-mt-2 text-xs" style={{ color: "var(--muted)" }}>
          Saving the resting place or burial date also records a Burial event on the family tree.
        </p>
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

      <div className="-mt-2 flex flex-wrap items-center gap-2 text-sm">
        <Dialog
          title="Biography wizard"
          label="✨ Biography wizard"
          wide
          buttonClass="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <form action={saveBioNotes.bind(null, treeId, memorial.id)} className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Fill in what the records can&apos;t tell us. Dates, places, parents, spouse, children
              and clan are pulled automatically. Save, then rebuild the eulogy to weave it together.
            </p>
            {BIO_FIELDS.map((f) => (
              <label key={f.key} className="text-sm">
                <span style={{ color: "var(--muted)" }}>{f.label}</span>
                <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>— {f.hint}</span>
                {f.rows > 1 ? (
                  <textarea name={f.key} rows={f.rows} defaultValue={bio[f.key] ?? ""} className={field} style={style} />
                ) : (
                  <input name={f.key} defaultValue={bio[f.key] ?? ""} className={field} style={style} />
                )}
              </label>
            ))}
            <div className="flex flex-wrap items-center gap-3 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="regenerate" value="1" defaultChecked /> Rebuild the eulogy now
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="overwrite" value="1" /> Replace the current eulogy (else append)
              </label>
            </div>
            <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Save &amp; build
            </button>
          </form>
        </Dialog>

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
              </fieldset>
              </>
            ),
          },
          {
            id: "service",
            label: "Service",
            panel: (
              <fieldset disabled={locked} className="contents">
      {/* ---- Funeral programme (audited) ---- */}
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Funeral programme</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Every change is recorded. {memorial.program?.updatedAt ? (
            <>Last edited {memorial.program.updatedAt.toISOString().slice(0, 16).replace("T", " ")} by{" "}
              {memorial.program.updatedBy?.name ?? memorial.program.updatedBy?.email ?? "someone"}.</>
          ) : null}
        </p>

        <form action={saveProgram.bind(null, treeId, memorial.id)} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Venue</span>
              <input name="venue" defaultValue={memorial.program?.venue ?? ""} className={field} style={style} />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Main service date</span>
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
            <span style={{ color: "var(--muted)" }}>Venue location</span>
            <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>
              — paste a Google Maps link, a plus code, or “lat, lng”
            </span>
            <input
              name="venueLocation"
              defaultValue={venueLoc}
              placeholder="-1.28640, 36.81724  ·  or  https://maps.app.goo.gl/…"
              className={field}
              style={style}
            />
          </label>
          {mapsHref({
            lat: memorial.program?.venueLat,
            lng: memorial.program?.venueLng,
            url: memorial.program?.venueMapUrl,
          }) && (
            <a
              href={mapsHref({ lat: memorial.program?.venueLat, lng: memorial.program?.venueLng, url: memorial.program?.venueMapUrl })!}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs hover:underline"
              style={{ color: "var(--link)" }}
            >
              📍 Open current venue location
            </a>
          )}
          <label className="mt-3 block text-sm">
            <span style={{ color: "var(--muted)" }}>Committee / contacts</span>
            <textarea name="committee" rows={2} defaultValue={memorial.program?.committee ?? ""} className={field} style={style} />
          </label>
          <button className="mt-3 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            Save details
          </button>
        </form>

        {/* order of service, grouped by day */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Order of service</h3>
          <div className="flex items-center gap-2">
          <Dialog
            title="Start from a programme template"
            label="✨ Use a template"
            wide
            buttonClass="rounded-lg border px-3 py-1.5 text-xs font-medium"
          >
            <form action={applyProgrammeTemplate.bind(null, treeId, memorial.id)} className="flex flex-col gap-3">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Scaffolds a full order of service you then edit item by item.
              </p>
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Template</span>
                <select name="templateId" className={field} style={style} defaultValue={PROGRAMME_TEMPLATES[0]?.id}>
                  {PROGRAMME_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} — {t.blurb}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span style={{ color: "var(--muted)" }}>Day 1 label</span>
                  <input name="d1" placeholder="Fri 12 Sep · Vigil" className={field} style={style} />
                </label>
                <label className="text-sm">
                  <span style={{ color: "var(--muted)" }}>Day 2 label (if used)</span>
                  <input name="d2" placeholder="Sat 13 Sep · Service & burial" className={field} style={style} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="replace" value="1" /> Replace any existing items
              </label>
              <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Build programme
              </button>
            </form>
          </Dialog>
          <Dialog
            title="Add a programme item"
            label="➕ Add item"
            buttonClass="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            <form action={addProgramItem.bind(null, treeId, memorial.id)} className="flex flex-col gap-3">
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Day (optional — e.g. “Fri 12 Sep · Viewing”)</span>
                <input name="day" list="programme-days" className={field} style={style} placeholder="Programme" />
                <datalist id="programme-days">
                  {orderDays.map((g) => (
                    <option key={g.day} value={g.day === "Programme" ? "" : g.day} />
                  ))}
                </datalist>
              </label>
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Item</span>
                <input name="title" required className={field} style={style} placeholder="Scripture reading" />
              </label>
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Who / note (optional)</span>
                <input name="detail" className={field} style={style} placeholder="Pastor J. Otieno" />
              </label>
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Location (optional)</span>
                <input name="location" className={field} style={style} placeholder="Map link, plus code, or lat, lng" />
              </label>
              <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Add item
              </button>
            </form>
          </Dialog>
          </div>
        </div>

        {order.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No items yet.</p>
        )}

        {orderDays.map((g) => (
          <div key={g.day} className="mt-3">
            {orderDays.length > 1 || g.day !== "Programme" ? (
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                {g.day}
              </div>
            ) : null}
            <ol className="mt-1 flex flex-col">
              {g.items.map((it, idx) => (
                <li
                  key={it.id}
                  className="flex items-center gap-2 border-t py-2 text-sm"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <span className="w-5 shrink-0 text-right" style={{ color: "var(--muted)" }}>{idx + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {it.title}
                    {it.detail ? <span style={{ color: "var(--muted)" }}> — {it.detail}</span> : null}
                    {mapsHref({ lat: it.lat, lng: it.lng, url: it.mapUrl }) && (
                      <a
                        href={mapsHref({ lat: it.lat, lng: it.lng, url: it.mapUrl })!}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1"
                        title="Open location"
                      >
                        📍
                      </a>
                    )}
                  </span>
                  <form action={moveProgramItem.bind(null, treeId, memorial.id, it.id, "up")}>
                    <button className="px-1 text-xs" style={{ color: "var(--muted)" }} title="Move up">↑</button>
                  </form>
                  <form action={moveProgramItem.bind(null, treeId, memorial.id, it.id, "down")}>
                    <button className="px-1 text-xs" style={{ color: "var(--muted)" }} title="Move down">↓</button>
                  </form>
                  <Dialog title="Edit item" label="✏️" buttonClass="px-1 text-xs">
                    <form action={updateProgramItem.bind(null, treeId, memorial.id, it.id)} className="flex flex-col gap-3">
                      <label className="text-sm">
                        <span style={{ color: "var(--muted)" }}>Day</span>
                        <input name="day" defaultValue={it.day ?? ""} className={field} style={style} />
                      </label>
                      <label className="text-sm">
                        <span style={{ color: "var(--muted)" }}>Item</span>
                        <input name="title" required defaultValue={it.title} className={field} style={style} />
                      </label>
                      <label className="text-sm">
                        <span style={{ color: "var(--muted)" }}>Who / note</span>
                        <input name="detail" defaultValue={it.detail ?? ""} className={field} style={style} />
                      </label>
                      <label className="text-sm">
                        <span style={{ color: "var(--muted)" }}>Location</span>
                        <input
                          name="location"
                          defaultValue={it.mapUrl ?? (it.lat != null && it.lng != null ? `${it.lat},${it.lng}` : "")}
                          className={field}
                          style={style}
                          placeholder="Map link, plus code, or lat, lng"
                        />
                      </label>
                      <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                        Save item
                      </button>
                    </form>
                  </Dialog>
                  <form action={removeProgramItem.bind(null, treeId, memorial.id, it.id)}>
                    <button className="px-1 text-xs" style={{ color: "var(--danger)" }} title="Remove">✕</button>
                  </form>
                </li>
              ))}
            </ol>
          </div>
        ))}

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
      </section>
              </fieldset>
            ),
          },
          {
            id: "people",
            label: "People helping",
            badge: submitted.length || undefined,
            panel: (
              <>
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

        {/* group link */}
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Group link</span>
            {memorial.groupContribToken ? (
              <form action={revokeGroupContribLink.bind(null, treeId, memorial.id)}>
                <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
                  revoke
                </button>
              </form>
            ) : (
              <form action={createGroupContribLink.bind(null, treeId, memorial.id)}>
                <button className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700">
                  Create group link
                </button>
              </form>
            )}
          </div>
          {memorial.groupContribToken ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">
                {contributeLink(memorial.groupContribToken)}
              </code>
              <CopyButton value={contributeLink(memorial.groupContribToken)} label="Copy link" />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Please add your memories of ${name} here: ${contributeLink(memorial.groupContribToken)}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md px-2.5 py-1 text-xs font-medium text-white"
                style={{ background: "#25D366" }}
              >
                Share to a group
              </a>
              <QrShare
                value={contributeLink(memorial.groupContribToken)}
                title="Group contribution QR"
                label="QR"
                caption={`Anyone can scan this to add a memory of ${name}.`}
                buttonClass="rounded-md border px-2 py-1 text-xs"
              />
            </div>
          ) : (
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              One link anyone can use — post it in a WhatsApp group so the whole family can
              contribute without an individual invite.
            </p>
          )}
        </div>

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
              {c.photoMediaIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.photoMediaIds.map((mid) => (
                    <div key={mid} className="h-16 w-16 overflow-hidden rounded border" style={{ borderColor: "var(--border)" }}>
                      <MediaThumb mediaId={mid} mimeType="image/jpeg" alt="" />
                    </div>
                  ))}
                  <span className="self-end text-xs" style={{ color: "var(--muted)" }}>
                    {c.photoMediaIds.length} photo{c.photoMediaIds.length === 1 ? "" : "s"} — attached to {name} on accept
                  </span>
                </div>
              )}
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
              </>
            ),
          },
          {
            id: "tributes",
            label: "Tributes & fund",
            badge: pending.length || undefined,
            panel: (
              <>
      {/* ---- Tributes (messages + flowers — the same thing) ---- */}
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">
          Tributes ({memorial.guestbook.length + memorial._count.flowers})
        </h2>
        {pending.length > 0 && (
          <p className="mt-1 text-sm text-amber-600">{pending.length} message(s) awaiting approval</p>
        )}

        <h3 className="mt-3 text-sm font-medium" style={{ color: "var(--muted)" }}>
          Messages ({memorial.guestbook.length})
        </h3>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
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
              {g._count.reactions > 0 && (
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  {g._count.reactions} reaction{g._count.reactions === 1 ? "" : "s"}
                </p>
              )}
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
              {g.replies.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5 border-l pl-3" style={{ borderColor: "var(--hairline)" }}>
                  {g.replies.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{r.name}</span>
                      <span style={{ color: "var(--muted)" }}> · {r.status.toLowerCase()}</span>
                      <p className="whitespace-pre-wrap">{r.message}</p>
                      <div className="mt-0.5 flex gap-2 text-xs">
                        {r.status !== "APPROVED" && (
                          <form action={moderateReply.bind(null, treeId, r.id, "APPROVED")}>
                            <button className="text-brand-600 hover:underline">approve</button>
                          </form>
                        )}
                        {r.status !== "HIDDEN" && (
                          <form action={moderateReply.bind(null, treeId, r.id, "HIDDEN")}>
                            <button className="text-red-600 hover:underline">hide</button>
                          </form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {memorial.guestbook.length === 0 && (
            <li style={{ color: "var(--muted)" }}>No entries yet.</li>
          )}
        </ul>

        <h3 className="mt-4 text-sm font-medium" style={{ color: "var(--muted)" }}>
          Flowers &amp; reactions ({memorial._count.flowers})
        </h3>
        {memorial.flowers.length === 0 ? (
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>None laid yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {memorial.flowers.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <span>{flowerEmoji(f.kind)}</span>
                <span className={f.hidden ? "line-through" : ""} style={f.hidden ? { color: "var(--muted)" } : undefined}>
                  {f.name ?? "In loving memory"}
                </span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {f.createdAt.toISOString().slice(0, 10)}
                </span>
                <form action={moderateFlower.bind(null, treeId, f.id, !f.hidden)} className="ml-auto">
                  <button className="text-xs hover:underline" style={{ color: f.hidden ? "var(--link)" : "var(--danger)" }}>
                    {f.hidden ? "restore" : "hide"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Welfare fund (chama plugin) ---- */}
      {chamaEnabled() && (
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Welfare fund</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          A family <em>chama</em> kitty for funeral costs. Share one link; supporters record what
          they send by M-Pesa and the treasurer confirms each against the statement.
        </p>

        {!memorial.chamaFund ? (
          <form action={openMemorialFund.bind(null, treeId, memorial.id)} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Target (optional)</span>
              <input
                name="targetKes"
                inputMode="numeric"
                placeholder="e.g. 200000"
                className="mt-1 w-40 rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              />
            </label>
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Open a welfare fund
            </button>
          </form>
        ) : (
          (() => {
            const fund = memorial.chamaFund;
            const url = `${origin}/give/${fund.publicToken}`;
            const live = fund.contributions.filter((c) => c.status !== "VOID");
            const confirmed = live.filter((c) => c.status === "CONFIRMED");
            const pending = live.filter((c) => c.status === "PLEDGED");
            const raised = confirmed.reduce((s, c) => s + c.amountKes, 0);
            const pledged = pending.reduce((s, c) => s + c.amountKes, 0);
            return (
              <div className="mt-3 flex flex-col gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-semibold">{KES(raised)}</span>
                  <span style={{ color: "var(--muted)" }}>
                    confirmed{fund.targetKes ? ` of ${KES(fund.targetKes)}` : ""} · {pending.length} pending ({KES(pledged)})
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {fund.status === "OPEN" ? "open" : "closed"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <code className="max-w-full overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">{url}</code>
                  <CopyButton value={url} label="Copy link" />
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Please support the family welfare fund: ${url}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-white"
                    style={{ background: "#25D366" }}
                  >
                    WhatsApp
                  </a>
                  <QrShare value={url} title="Welfare fund QR" label="QR" caption="Scan to contribute" buttonClass="rounded-md border px-2 py-1 text-xs" />
                  <form action={setMemorialFundOpen.bind(null, treeId, memorial.id, fund.id, fund.status !== "OPEN")}>
                    <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                      {fund.status === "OPEN" ? "close fund" : "reopen"}
                    </button>
                  </form>
                </div>

                {pending.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                      Awaiting confirmation
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {pending.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
                          <span className="font-medium">{c.contributorName}</span>
                          <span>{KES(c.amountKes)}</span>
                          {c.mpesaCode && <span style={{ color: "var(--muted)" }}>· {c.mpesaCode}</span>}
                          {c.note && <span style={{ color: "var(--muted)" }}>· {c.note}</span>}
                          <form action={confirmFundContribution.bind(null, treeId, memorial.id, c.id)} className="ml-auto flex items-center gap-1">
                            <input name="mpesaCode" placeholder="M-Pesa code" className="w-28 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
                            <button className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white">confirm</button>
                          </form>
                          <form action={voidFundContribution.bind(null, treeId, memorial.id, c.id)}>
                            <button className="text-xs" style={{ color: "var(--danger)" }}>void</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {confirmed.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs" style={{ color: "var(--muted)" }}>
                      {confirmed.length} confirmed contribution{confirmed.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="mt-1 flex flex-col gap-1">
                      {confirmed.map((c) => (
                        <li key={c.id} className="flex items-center gap-2">
                          <span className="font-medium">{c.contributorName}</span>
                          <span>{KES(c.amountKes)}</span>
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            {(c.confirmedAt ?? c.createdAt).toISOString().slice(0, 10)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })()
        )}
      </section>
      )}
              </>
            ),
          },
        ]}
      />

      <form action={deleteMemorial.bind(null, treeId, memorial.id)}>
        <button className="text-xs text-red-600 hover:underline">Delete this memorial</button>
      </form>
    </div>
  );
}
