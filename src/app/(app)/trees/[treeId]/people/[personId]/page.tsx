import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { getPersonDetail, getPersonRelations, personOptions } from "@/lib/queries/people";
import { personMedia } from "@/lib/queries/media";
import { displayName, genderSymbol, genderColor } from "@/lib/person";
import { formatDate, dateSortKey } from "@/lib/date";
import { PersonChip } from "@/components/PersonChip";
import { MediaThumb } from "@/components/media/MediaThumb";
import { UploadForm } from "@/components/media/UploadForm";
import { AddParentButton, AddPartnerButton, AddChildButton } from "@/components/QuickAdd";
import { Dialog } from "@/components/Dialog";
import { CopyButton } from "@/components/CopyButton";
import { QrShare } from "@/components/QrShare";
import { primaryName } from "@/lib/person";
import { deletePerson } from "../actions";
import { uploadPersonPhoto, detachPersonMedia } from "../../media/actions";
import {
  addParent,
  addPartner,
  addChildToFamily,
  addFirstChild,
  recordDeath,
  createClaimInvite,
  revokeClaimInvite,
} from "./quick-actions";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ treeId: string; personId: string }>;
}) {
  const { treeId, personId } = await params;
  const ctx = await loadTreeContext(treeId);
  const person = await getPersonDetail(treeId, personId);
  if (!person) notFound();
  const relations = await getPersonRelations(treeId, personId);
  const media = await personMedia(treeId, personId);
  const editable = canEdit(ctx.role);
  const pickList = editable
    ? (await personOptions(treeId))
        .filter((o) => o.id !== personId)
        .map((o) => ({ id: o.id, label: o.label }))
    : [];

  const events = [...person.eventRefs]
    .map((r) => r.event)
    .sort((a, b) => dateSortKey(a).localeCompare(dateSortKey(b)));

  // "Deceased" is driven ONLY by a recorded Death/Burial event. Person.living
  // defaults to false on import, so it is not evidence of death.
  const deceased = events.some((e) => e.type === "Death" || e.type === "Burial");
  const fieldStyle = { borderColor: "var(--border)", background: "var(--surface-2)" };

  const claimable = editable && !deceased && !person.claimedByUserId;
  const claimInvite = claimable
    ? await db.claimInvite.findFirst({
        where: { personId, revokedAt: null, usedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, token: true, expiresAt: true },
      })
    : null;
  const claimUrl = claimInvite ? `${await publicOrigin()}/claim/${claimInvite.token}` : null;
  const claimWa = claimUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hi — this is your profile on our family tree. Confirm it's you here: ${claimUrl}`,
      )}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/trees/${treeId}/people`}
            className="text-sm hover:underline"
            style={{ color: "var(--muted)" }}
          >
            ← People
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">
            {genderSymbol(person.gender) && (
              <span className="mr-1.5 align-middle text-xl" title={person.gender.toLowerCase()} style={{ color: genderColor(person.gender) }}>
                {genderSymbol(person.gender)}
              </span>
            )}
            {displayName(person.names)}
            {deceased && (
              <span className="ml-2 align-middle" title="Deceased" style={{ color: "var(--muted)" }}>
                †
              </span>
            )}
            {person.claimedByUserId === ctx.user.id && (
              <span className="ml-2 align-middle rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                This is you
              </span>
            )}
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {person.gender.toLowerCase()}
            {deceased ? " · deceased" : person.living ? " · living" : ""}
            {person.clan ? ` · ${person.clan.name} clan` : ""}
            {person.subClan ? ` (${person.subClan})` : ""}
            {person.phone ? ` · ${person.phone}` : ""}
            {person.claimedByUserId && person.claimedByUserId !== ctx.user.id
              ? ` · claimed by ${person.claimedBy?.name ?? "a relative"}`
              : ""}
            {person.grampsId ? ` · ${person.grampsId}` : ""}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            {!deceased && (
              <Dialog
                title={`Record a death — ${displayName(person.names)}`}
                label="Record a death"
                buttonClass="rounded-lg border px-3 py-1.5 text-sm"
              >
                <form action={recordDeath.bind(null, treeId, personId)} className="flex flex-col gap-3">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    Marks this person as deceased and adds a Death event. This enables the memorial
                    page and applies the deceased marker across the tree.
                  </p>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Date of death (optional)</span>
                    <input name="deathDate" placeholder="YYYY-MM-DD or free text" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                  </label>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Place of death (optional)</span>
                    <input name="deathPlace" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} list="ke-loc" />
                  </label>
                  <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Record death
                  </button>
                </form>
              </Dialog>
            )}
            {deceased && (
              <Link
                href={`/trees/${treeId}/people/${personId}/memorial`}
                className="rounded-lg border px-3 py-1.5 text-sm"
                style={{ borderColor: "var(--color-brand-600)", color: "var(--color-brand-700)" }}
              >
                Memorial
              </Link>
            )}
            <Link
              href={`/trees/${treeId}/people/${personId}/edit`}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              Edit
            </Link>
            <form action={deletePerson.bind(null, treeId, personId)}>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm text-red-600"
                style={{ borderColor: "var(--border)" }}
              >
                Delete
              </button>
            </form>
          </div>
        )}
      </div>

      {person.claimedByUserId && person.claimedByUserId !== ctx.user.id && (
        <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)", color: "var(--muted)" }}>
          Claimed by {person.claimedBy?.name ?? "a relative"}.
        </p>
      )}

      {claimable && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium">Claim link</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Send this person a private link so they can confirm the profile is theirs and keep it
                updated. You approve every claim.
              </p>
            </div>
            {!claimInvite && (
              <Dialog
                title={`Send ${displayName(person.names)} a claim link`}
                label="Create claim link"
                buttonClass="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <form action={createClaimInvite.bind(null, treeId, personId)} className="flex flex-col gap-3">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    Generates a one-person link valid for 30 days. Share it from your own phone.
                  </p>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Note for them (optional)</span>
                    <textarea name="note" rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                  </label>
                  <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Create link
                  </button>
                </form>
              </Dialog>
            )}
          </div>

          {claimInvite && claimUrl && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">{claimUrl}</code>
              <CopyButton value={claimUrl} label="Copy link" />
              <a
                href={claimWa ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-md px-2.5 py-1 text-xs font-medium text-white"
                style={{ background: "#25D366" }}
              >
                WhatsApp
              </a>
              <QrShare
                value={claimUrl}
                title="Claim link QR"
                label="QR"
                caption={`${displayName(person.names)} can scan this to claim the profile.`}
                buttonClass="rounded-md border px-2 py-1 text-xs"
              />
              <form action={revokeClaimInvite.bind(null, treeId, personId, claimInvite.id)}>
                <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
                  revoke
                </button>
              </form>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {claimInvite.expiresAt ? `expires ${claimInvite.expiresAt.toISOString().slice(0, 10)}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <h3 className="font-medium">Timeline</h3>
          {events.length === 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              No events recorded.
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-28 shrink-0" style={{ color: "var(--muted)" }}>
                  {formatDate(e) || "—"}
                </span>
                <span>
                  <span className="font-medium">{e.type}</span>
                  {e.place ? ` · ${e.place.title}` : ""}
                  {e.description ? ` — ${e.description}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <h3 className="font-medium">Parents</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {relations?.parents.length
                ? relations.parents.map((p) => <PersonChip key={p.id} person={p} treeId={treeId} />)
                : <span className="text-sm" style={{ color: "var(--muted)" }}>Not recorded</span>}
              {editable && !relations?.parentFamily?.hasFather && (
                <AddParentButton
                  role="father"
                  surname={primaryName(person.names)?.surname}
                  action={addParent.bind(null, treeId, personId)}
                  people={pickList}
                />
              )}
              {editable && !relations?.parentFamily?.hasMother && (
                <AddParentButton
                  role="mother"
                  action={addParent.bind(null, treeId, personId)}
                  people={pickList}
                />
              )}
            </div>
            {relations?.siblings.length ? (
              <>
                <h4 className="mt-3 text-sm font-medium">Siblings</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {relations.siblings.map((p) => (
                    <PersonChip key={p.id} person={p} treeId={treeId} />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Partners &amp; children</h3>
              {editable && (
                <AddPartnerButton
                  action={addPartner.bind(null, treeId, personId)}
                  buttonClass="text-xs text-brand-600 hover:underline"
                  people={pickList}
                />
              )}
            </div>
            {relations?.families.length
              ? relations.families.map((f) => (
                  <div key={f.id} className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PersonChip person={f.spouse} treeId={treeId} />
                      <Link
                        href={`/trees/${treeId}/families/${f.id}`}
                        className="text-xs hover:underline"
                        style={{ color: "var(--muted)" }}
                      >
                        open family
                      </Link>
                      {editable && (
                        <AddChildButton
                          action={addChildToFamily.bind(null, treeId, f.id)}
                          back={`/trees/${treeId}/people/${personId}`}
                          people={pickList}
                        />
                      )}
                    </div>
                    {f.children.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 pl-4">
                        {f.children.map((c) => (
                          <PersonChip key={c.id} person={c} treeId={treeId} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              : (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    None recorded.
                  </p>
                  {editable && (
                    <AddChildButton action={addFirstChild.bind(null, treeId, personId)} people={pickList} />
                  )}
                </div>
              )}
          </div>
        </div>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Photos &amp; documents</h3>
        {media.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {media.map((r) => (
              <figure
                key={r.id}
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: "var(--border)" }}
              >
                <a
                  href={`/api/media/${r.media.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square"
                >
                  <MediaThumb
                    mediaId={r.media.id}
                    mimeType={r.media.mimeType}
                    alt={r.caption ?? r.media.fileName}
                  />
                </a>
                {editable && (
                  <form action={detachPersonMedia.bind(null, treeId, personId, r.id)}>
                    <button className="w-full py-1 text-[10px] text-red-600 hover:underline">
                      remove
                    </button>
                  </form>
                )}
              </figure>
            ))}
          </div>
        )}
        {editable && (
          <div className="mt-3">
            <UploadForm
              action={uploadPersonPhoto.bind(null, treeId, personId)}
              name="file"
              multiple={false}
              withOccasion
              label="Add a photo for this person"
            />
          </div>
        )}
        {media.length === 0 && !editable && (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            No photos attached.
          </p>
        )}
      </section>
    </div>
  );
}
