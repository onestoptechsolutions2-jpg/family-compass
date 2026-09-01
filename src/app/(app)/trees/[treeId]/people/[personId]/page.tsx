import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext, canEdit, canManageTree } from "@/lib/rbac";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { getPersonDetail, getPersonRelations, personOptions, claimableRelatives } from "@/lib/queries/people";
import { personCircle, personMemories, RELATION_ROLES, RELATION_CONTEXTS } from "@/lib/relationships";
import { friendLinksForPerson, pendingFriendInvites } from "@/lib/friends";
import { addMemoryAction, addToCircleAction, inviteFriendAction } from "./relationship-actions";
import { isProfileClaimable } from "@/lib/claim-eligibility";
import { analyzeProfile } from "@/lib/profile-analyzer";
import { ClaimedWizard } from "@/components/ClaimedWizard";
import { ProfileGaps } from "@/components/ProfileGaps";
import { personMedia } from "@/lib/queries/media";
import { commentsForEvents } from "@/lib/discussions";
import { displayName, genderSymbol, genderColor, genderLabel } from "@/lib/person";
import { formatDate, dateSortKey } from "@/lib/date";
import { PersonChip } from "@/components/PersonChip";
import { MediaThumb } from "@/components/media/MediaThumb";
import { UploadForm } from "@/components/media/UploadForm";
import { AddParentButton, AddPartnerButton, AddChildButton } from "@/components/QuickAdd";
import { Dialog } from "@/components/Dialog";
import { SearchSelect } from "@/components/SearchSelect";
import { Tabs } from "@/components/Tabs";
import { ActionMenu, actionItemClass } from "@/components/ActionMenu";
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
  addEvent,
  setPersonPrivacy,
  createClaimInvite,
  revokeClaimInvite,
  addEventComment,
  resolveEventComment,
  markProfileClaimed,
  unlinkProfileClaim,
  inviteRelativeToClaim,
} from "./quick-actions";
import { PERSON_EVENT_TYPES } from "@/lib/event-types";

const monogram = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";

function Pill({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={
        accent
          ? { background: "var(--accent-soft)", color: "var(--accent)" }
          : { background: "var(--surface-2)", color: "var(--muted)" }
      }
    >
      {children}
    </span>
  );
}

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string; personId: string }>;
  searchParams: Promise<{ invited?: string; welcome?: string }>;
}) {
  const { treeId, personId } = await params;
  const { invited, welcome } = await searchParams;
  const ctx = await loadTreeContext(treeId);
  const person = await getPersonDetail(treeId, personId);
  if (!person) notFound();
  const relations = await getPersonRelations(treeId, personId);
  const media = await personMedia(treeId, personId);
  const [circle, relMemories, friendLinks, friendPending] = await Promise.all([
    personCircle(treeId, personId),
    personMemories(treeId, personId),
    friendLinksForPerson(personId),
    pendingFriendInvites(treeId),
  ]);
  const myFriendPending = friendPending.filter((f) => f.fromPersonId === personId);
  const analysis = canEdit(ctx.role) ? await analyzeProfile(treeId, personId, ctx.user.id) : null;
  const eventComments = await commentsForEvents(
    [...person.eventRefs].map((r) => r.event.id),
  );
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

  const birthEv = events.find((e) => e.type === "Birth");
  const deathEv = events.find((e) => e.type === "Death") ?? events.find((e) => e.type === "Burial");
  const vitals = [
    genderLabel(person.gender),
    birthEv ? `b. ${[formatDate(birthEv), birthEv.place?.title].filter(Boolean).join(", ")}` : null,
    deathEv
      ? `d. ${[formatDate(deathEv), deathEv.place?.title].filter(Boolean).join(", ")}`
      : !deceased && person.living
        ? "living"
        : null,
    person.clan ? `${person.clan.name} clan${person.subClan ? ` (${person.subClan})` : ""}` : null,
  ].filter(Boolean);
  const avatarId = media.find((r) => r.media.mimeType.startsWith("image/"))?.media.id ?? null;

  const manages = canManageTree(ctx.role);
  const claimable =
    editable && isProfileClaimable({ claimedByUserId: person.claimedByUserId, deceased });
  const treeMembers = manages && claimable
    ? await db.membership.findMany({
        where: { workspace: { trees: { some: { id: treeId } } } },
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      })
    : [];
  const claimInvite = claimable
    ? await db.claimInvite.findFirst({
        where: { personId, revokedAt: null, usedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, token: true, expiresAt: true },
      })
    : null;
  const origin = await publicOrigin();
  const claimUrl = claimInvite ? `${origin}/claim/${claimInvite.token}` : null;

  const kinToInvite = editable ? claimableRelatives(relations) : [];
  const invitedRelative =
    editable && invited
      ? await db.person.findFirst({
          where: { id: invited, treeId },
          select: {
            names: { select: { first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true, preferred: true, type: true, order: true } },
            claimInvites: {
              where: { revokedAt: null, usedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { token: true },
            },
          },
        })
      : null;
  const invitedLink = invitedRelative?.claimInvites[0]
    ? {
        name: displayName(invitedRelative.names),
        url: `${origin}/claim/${invitedRelative.claimInvites[0].token}`,
      }
    : null;
  const claimWa = claimUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hi — this is your profile on our family tree. Confirm it's you here: ${claimUrl}`,
      )}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      {person.claimedByUserId === ctx.user.id && !deceased && (
        <ClaimedWizard
          personId={personId}
          treeName={ctx.tree.name}
          force={!!welcome}
          steps={[
            {
              done: !!(primaryName(person.names)?.first && primaryName(person.names)?.surname),
              label: "Confirm your name and dates",
              href: `/trees/${treeId}/people/${personId}/edit`,
              cta: "Edit details",
            },
            {
              done: events.some((e) => e.type === "Birth"),
              label: "Add your date & place of birth",
              href: `/trees/${treeId}/people/${personId}/edit`,
              cta: "Add birth",
            },
            {
              done: (relations?.parents.length ?? 0) > 0,
              label: "Add your parents",
              href: `/trees/${treeId}/people/${personId}#tab=family`,
              cta: "Add parents",
            },
            {
              done: media.length > 0,
              label: "Add a photo of yourself",
              href: `/trees/${treeId}/people/${personId}#tab=photos`,
              cta: "Add photo",
            },
            {
              done: false,
              label: "Explore the family tree, centred on you",
              href: `/trees/${treeId}/tree?focus=${personId}`,
              cta: "Explore",
            },
          ]}
        />
      )}

      {analysis && !deceased && analysis.gaps.length > 0 && (
        <ProfileGaps
          personId={personId}
          self={analysis.self}
          ancestry={analysis.ancestry}
          gaps={analysis.gaps}
        />
      )}

      <div>
        <Link
          href={`/trees/${treeId}/people`}
          className="text-sm hover:underline"
          style={{ color: "var(--muted)" }}
        >
          ← People
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full text-lg font-semibold text-white"
              style={{ background: genderColor(person.gender) || "var(--accent)" }}
            >
              {avatarId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${avatarId}?v=thumb`} alt="" className="h-full w-full object-cover" />
              ) : (
                monogram(displayName(person.names))
              )}
            </span>
            <div>
              <h2 className="text-2xl font-semibold leading-tight">
                {deceased && (
                  <span className="mr-1.5 align-middle text-lg" title="Deceased" style={{ color: "var(--muted)" }}>†</span>
                )}
                {genderSymbol(person.gender) && (
                  <span className="mr-1.5 align-middle text-lg" title={genderLabel(person.gender)} style={{ color: genderColor(person.gender) }}>
                    {genderSymbol(person.gender)}
                  </span>
                )}
                {displayName(person.names)}
              </h2>
              {vitals.length > 0 && (
                <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
                  {vitals.join("  ·  ")}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {deceased && <Pill>† deceased</Pill>}
                {!deceased && person.claimedByUserId === ctx.user.id && <Pill accent>This is you</Pill>}
                {person.privacy === "PRIVATE" && <Pill>hidden from public</Pill>}
                {person.privacy === "REDACTED" && <Pill>limited on public</Pill>}
                {person.privacy !== "PRIVATE" && person.privacy !== "REDACTED" &&
                  (person.publicDatePrecision !== "FULL" || person.hidePhotosPublic) && (
                    <Pill>
                      public:{" "}
                      {[
                        person.publicDatePrecision === "YEAR" && "years only",
                        person.publicDatePrecision === "NONE" && "no dates",
                        person.hidePhotosPublic && "no photos",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </Pill>
                  )}
                {person.claimedByUserId && person.claimedByUserId !== ctx.user.id && (
                  <Pill>claimed by {person.claimedBy?.name ?? "a relative"}</Pill>
                )}
                {person.phone && <Pill>{person.phone}</Pill>}
              </div>
            </div>
          </div>
        {editable && (
          <div className="flex flex-wrap items-start gap-2">
            {!deceased && person.claimedByUserId === ctx.user.id && (
              <Link
                href={`/trees/${treeId}/tree?focus=${personId}`}
                className="rounded-lg border px-3 py-1.5 text-sm"
                style={{ borderColor: "var(--color-brand-600)", color: "var(--color-brand-700)" }}
              >
                Tree centred on you
              </Link>
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
            <ActionMenu>
              <Link href={`/trees/${treeId}/people/${personId}/edit`} className={actionItemClass}>
                Edit details
              </Link>

              {!deceased && (
                <Dialog
                  title={`Record a death — ${displayName(person.names)}`}
                  label="✝ Record death"
                  buttonClass={actionItemClass}
                >
                  <form action={recordDeath.bind(null, treeId, personId)} className="flex flex-col gap-3">
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      Marks this person as deceased and adds a Death event — this enables the memorial
                      page and the deceased marker across the tree.
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

              <Dialog
                title={`Add an event — ${displayName(person.names)}`}
                label="＋ Add event"
                buttonClass={actionItemClass}
              >
                <form action={addEvent.bind(null, treeId, personId)} className="flex flex-col gap-3">
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Type</span>
                    <select
                      name="type"
                      defaultValue="Baptism"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      style={fieldStyle}
                    >
                      {PERSON_EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Date (optional)</span>
                    <input name="date" placeholder="YYYY-MM-DD or free text" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                  </label>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Place (optional)</span>
                    <input name="place" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} list="ke-loc" />
                  </label>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Note (optional)</span>
                    <input name="description" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                  </label>
                  <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Add event
                  </button>
                </form>
              </Dialog>

              <Dialog
                title={`Visibility — ${displayName(person.names)}`}
                label="🔒 Privacy"
                buttonClass={actionItemClass}
              >
                <form action={setPersonPrivacy.bind(null, treeId, personId)} className="flex flex-col gap-3">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    Controls what public shared trees and profile links reveal. Family members
                    signed in to this tree always see everything.
                  </p>
                  {(
                    [
                      ["INHERIT", "Default", "Follows the tree — living people are shown as “Living …” on public shares."],
                      ["PUBLIC", "Public", "Name, dates, photos and profile are visible on public shares."],
                      ["REDACTED", "Limited", "Appears in the tree by name only — no dates, no photos, no profile page."],
                      ["PRIVATE", "Hidden", "Removed entirely from public shares and the tree graph."],
                    ] as const
                  ).map(([value, label, note]) => (
                    <label key={value} className="flex gap-2 text-sm">
                      <input
                        type="radio"
                        name="privacy"
                        value={value}
                        defaultChecked={(person.privacy ?? "INHERIT") === value}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{label}</span>
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>{note}</span>
                      </span>
                    </label>
                  ))}
                  <div className="border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                      When shown publicly
                    </p>
                    <label className="mt-2 block text-sm">
                      <span style={{ color: "var(--muted)" }}>Dates</span>
                      <select
                        name="datePrecision"
                        defaultValue={person.publicDatePrecision ?? "FULL"}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        style={fieldStyle}
                      >
                        <option value="FULL">Full dates</option>
                        <option value="YEAR">Year only</option>
                        <option value="NONE">No dates</option>
                      </select>
                    </label>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" name="hidePhotos" value="true" defaultChecked={person.hidePhotosPublic} />
                      Hide this person&apos;s photos on public shares
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="cascade" value="true" />
                    Also apply to everyone descended from this person
                  </label>
                  <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Save visibility
                  </button>
                </form>
              </Dialog>

              <form action={deletePerson.bind(null, treeId, personId)}>
                <button className={`${actionItemClass} text-red-600`}>Delete person</button>
              </form>
            </ActionMenu>
          </div>
        )}
        </div>
      </div>

      {person.claimedByUserId && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)", color: "var(--muted)" }}>
          <span>
            {deceased
              ? `This profile was linked to ${person.claimedBy?.name ?? "an account"} before the death was recorded.`
              : person.claimedByUserId === ctx.user.id
                ? "You have claimed this profile."
                : `Claimed by ${person.claimedBy?.name ?? "a relative"}.`}
          </span>
          {manages && (
            <form action={unlinkProfileClaim.bind(null, treeId, personId)}>
              <button className="hover:underline" style={{ color: "var(--danger)" }}>unlink</button>
            </form>
          )}
        </div>
      )}

      {claimable && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium">This is a living person&apos;s profile</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Send them a private link to claim it themselves, or — if they&apos;re already on this
                tree — a manager can mark it claimed directly. A profile can only be claimed while
                the person is living.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {manages && (
                <Dialog
                  title={`Mark ${displayName(person.names)}'s profile as claimed`}
                  label="Mark as claimed"
                  buttonClass="rounded-lg border px-3 py-1.5 text-sm"
                >
                  <form action={markProfileClaimed.bind(null, treeId, personId)} className="flex flex-col gap-3">
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      Links this profile straight to an account already on the tree — no invite or
                      approval. Use only when you know it&apos;s really them.
                    </p>
                    <label className="text-sm">
                      <span style={{ color: "var(--muted)" }}>Account</span>
                      <select name="who" defaultValue="me" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>
                        <option value="me">This is me ({ctx.user.name ?? ctx.user.email})</option>
                        {treeMembers
                          .filter((m) => m.user.id !== ctx.user.id)
                          .map((m) => (
                            <option key={m.user.id} value={m.user.id}>
                              {m.user.name ?? m.user.email} · {m.role.toLowerCase()}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span style={{ color: "var(--muted)" }}>Role on this tree</span>
                      <select name="role" defaultValue="CONTRIBUTOR" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>
                        <option value="VIEWER">Viewer</option>
                        <option value="CONTRIBUTOR">Contributor</option>
                        <option value="EDITOR">Editor</option>
                      </select>
                    </label>
                    <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                      Link profile
                    </button>
                  </form>
                </Dialog>
              )}
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

      {invitedLink && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}>
          <h3 className="font-medium">Claim link for {invitedLink.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">{invitedLink.url}</code>
            <CopyButton value={invitedLink.url} label="Copy link" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hi ${invitedLink.name} — this is your profile on our family tree. Confirm it's you here: ${invitedLink.url}`)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-2.5 py-1 text-xs font-medium text-white"
              style={{ background: "#25D366" }}
            >
              WhatsApp
            </a>
            <QrShare value={invitedLink.url} title={`Claim link — ${invitedLink.name}`} label="QR" caption={`${invitedLink.name} scans to claim the profile.`} buttonClass="rounded-md border px-2 py-1 text-xs" />
          </div>
        </div>
      )}

      {editable && kinToInvite.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium">Invite family to claim their profiles</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Living relatives on this page who don&apos;t yet have an account. Send each a private
                link — they confirm and a manager approves.
              </p>
            </div>
            <Dialog title="Invite family to claim" label="Send claim links" buttonClass="rounded-lg border px-3 py-1.5 text-sm">
              <ul className="flex flex-col gap-2">
                {kinToInvite.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm" style={{ borderColor: "var(--hairline)" }}>
                    <span>
                      <Link href={`/trees/${treeId}/people/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                      <span style={{ color: "var(--muted)" }}> · {r.tie}</span>
                    </span>
                    <form action={inviteRelativeToClaim.bind(null, treeId, personId, r.id)}>
                      <button className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700">
                        Create link
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Dialog>
          </div>
        </div>
      )}

      <Tabs
        items={[
          {
            id: "family",
            label: "Family",
            panel: (
              <>
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
            {(
              [
                ["Siblings", relations?.siblings],
                ["Half-siblings", relations?.halfSiblings],
                ["Step-parents", relations?.stepParents],
                ["Step-siblings", relations?.stepSiblings],
              ] as const
            ).map(([label, list]) =>
              list && list.length > 0 ? (
                <div key={label}>
                  <h4 className="mt-3 text-sm font-medium">{label}</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {list.map((p) => (
                      <PersonChip key={p.id} person={p} treeId={treeId} />
                    ))}
                  </div>
                </div>
              ) : null,
            )}
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
            {relations && relations.stepChildren.length > 0 && (
              <div>
                <h4 className="mt-3 text-sm font-medium">Step-children</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {relations.stepChildren.map((c) => (
                    <PersonChip key={c.id} person={c} treeId={treeId} />
                  ))}
                </div>
              </div>
            )}
          </div>
              </>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            badge: events.length || undefined,
            panel: (
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <h3 className="font-medium">Timeline</h3>
                {events.length === 0 && (
                  <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No events recorded.</p>
                )}
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {events.map((e) => {
                    const thread = eventComments.get(e.id) ?? [];
                    const open = thread.filter((c) => !c.resolvedAt).length;
                    return (
                      <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="w-28 shrink-0" style={{ color: "var(--muted)" }}>{formatDate(e) || "—"}</span>
                        <span>
                          <span className="font-medium">{e.type}</span>
                          {e.place ? ` · ${e.place.title}` : ""}
                          {e.description ? ` — ${e.description}` : ""}
                        </span>
                        {editable && (
                          <Dialog
                            title={`Discuss — ${e.type}${formatDate(e) ? ` (${formatDate(e)})` : ""}`}
                            label={thread.length ? `💬 ${thread.length}${open ? ` · ${open} open` : ""}` : "💬 discuss"}
                            buttonClass="rounded-full border px-2 py-0.5 text-xs"
                          >
                            <div className="flex flex-col gap-3">
                              {thread.length === 0 && (
                                <p className="text-sm" style={{ color: "var(--muted)" }}>
                                  Start a thread — a date query, a correction, or a note for the family.
                                </p>
                              )}
                              <ul className="flex flex-col gap-2">
                                {thread.map((c) => (
                                  <li
                                    key={c.id}
                                    className="rounded-lg border p-2 text-sm"
                                    style={{ borderColor: "var(--hairline)", background: c.resolvedAt ? "var(--surface-2)" : undefined }}
                                  >
                                    <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
                                      <span>{c.author} · {c.createdAt.toISOString().slice(0, 10)}</span>
                                      <form action={resolveEventComment.bind(null, treeId, personId, c.id, !c.resolvedAt)}>
                                        <button className="hover:underline">
                                          {c.resolvedAt ? `resolved by ${c.resolver ?? "—"} · reopen` : "mark resolved"}
                                        </button>
                                      </form>
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                                  </li>
                                ))}
                              </ul>
                              <form action={addEventComment.bind(null, treeId, personId, e.id)} className="flex flex-col gap-2">
                                <textarea
                                  name="body"
                                  required
                                  rows={3}
                                  placeholder="Add to the discussion…"
                                  className="w-full rounded-lg border px-3 py-2 text-sm"
                                  style={fieldStyle}
                                />
                                <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                                  Post
                                </button>
                              </form>
                            </div>
                          </Dialog>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          },
          {
            id: "photos",
            label: "Photos",
            badge: media.length || undefined,
            panel: (
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
            ),
          },
          {
            id: "circle",
            label: "Circle",
            badge: circle.length || undefined,
            panel: (
              <section
                className="flex flex-col gap-4 rounded-xl border p-4"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">Circle &amp; shared history</h3>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      The people {displayName(person.names)} is close to — related or not. Closeness
                      is read from the memories they share, not set by hand.
                    </p>
                  </div>
                  {editable && (
                    <div className="flex flex-wrap gap-2">
                      <Dialog label="Add a memory" title="A shared memory" wide>
                        <form action={addMemoryAction.bind(null, treeId, personId)} className="flex flex-col gap-3">
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>What happened</span>
                            <input name="title" required maxLength={200} placeholder="The road trip to Kisumu" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                          </label>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>Tell it (optional)</span>
                            <textarea name="body" rows={4} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                          </label>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>Roughly when (optional)</span>
                            <input name="dateText" placeholder="about 2016 · the year we moved" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                          </label>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>Who else was there</span>
                            <SearchSelect
                              name="others"
                              multiple
                              options={pickList.map((o) => ({ value: o.id, label: o.label }))}
                              placeholder="Search people…"
                            />
                            <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>
                              Add as many as you like. Each person can add their own side later.
                            </span>
                          </label>
                          <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                            Save memory
                          </button>
                        </form>
                      </Dialog>

                      <Dialog label="Add to circle" title="Add someone to the circle" wide>
                        <form action={addToCircleAction.bind(null, treeId, personId)} className="flex flex-col gap-3">
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>Who</span>
                            <SearchSelect
                              name="person"
                              required
                              allowEmpty={false}
                              options={pickList.map((o) => ({ value: o.id, label: o.label }))}
                              placeholder="Search people in the tree…"
                            />
                          </label>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>They are a…</span>
                            <select name="role" defaultValue="friend" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>
                              {RELATION_ROLES.map((r) => (
                                <option key={r} value={r}>{r.replace(/-/g, " ")}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>How did this start?</span>
                            <textarea name="originText" rows={3} placeholder="My father worked with him at KPLC and they stayed close" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-sm">
                              <span style={{ color: "var(--muted)" }}>Through (optional)</span>
                              <SearchSelect
                                name="via"
                                options={pickList.map((o) => ({ value: o.id, label: o.label }))}
                                emptyLabel="— nobody in particular —"
                                placeholder="Search people…"
                              />
                            </label>
                            <label className="text-sm">
                              <span style={{ color: "var(--muted)" }}>Context (optional)</span>
                              <select name="originContext" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>
                                <option value="">—</option>
                                {RELATION_CONTEXTS.map((c) => (
                                  <option key={c} value={c}>{c.replace(/-/g, " ")}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>Roughly when it started (optional)</span>
                            <input name="originAt" placeholder="early 2000s" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                          </label>
                          <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                            Add to circle
                          </button>
                        </form>
                      </Dialog>

                      <Dialog label="Invite a friend" title="Invite a friend to their own tree" wide>
                        <form action={inviteFriendAction.bind(null, treeId, personId)} className="flex flex-col gap-3">
                          <p className="text-sm" style={{ color: "var(--muted)" }}>
                            For someone who isn&apos;t on this tree and isn&apos;t related. They get
                            their <em>own</em> family tree, centred on themselves, and the two of
                            you stay connected across families.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-sm">
                              <span style={{ color: "var(--muted)" }}>Their name</span>
                              <input name="name" required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                            </label>
                            <label className="text-sm">
                              <span style={{ color: "var(--muted)" }}>Their WhatsApp (optional)</span>
                              <input name="phone" inputMode="tel" placeholder="+2547…" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                            </label>
                          </div>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>They are a…</span>
                            <select name="role" defaultValue="friend" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>
                              {RELATION_ROLES.map((r) => (
                                <option key={r} value={r}>{r.replace(/-/g, " ")}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm">
                            <span style={{ color: "var(--muted)" }}>How do you know them?</span>
                            <textarea name="originText" rows={2} placeholder="We were at university together" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle} />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-sm">
                              <span style={{ color: "var(--muted)" }}>Through (optional)</span>
                              <SearchSelect
                                name="via"
                                options={pickList.map((o) => ({ value: o.id, label: o.label }))}
                                emptyLabel="— nobody in particular —"
                                placeholder="Search people…"
                              />
                            </label>
                            <label className="text-sm">
                              <span style={{ color: "var(--muted)" }}>Context (optional)</span>
                              <select name="originContext" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>
                                <option value="">—</option>
                                {RELATION_CONTEXTS.map((c) => (
                                  <option key={c} value={c}>{c.replace(/-/g, " ")}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                            Create invite link
                          </button>
                        </form>
                      </Dialog>
                    </div>
                  )}
                </div>

                {circle.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {circle.map((c) => (
                      <li key={c.edgeId} className="rounded-lg border p-3" style={{ borderColor: "var(--hairline)" }}>
                        <div className="flex flex-wrap items-center gap-2">
                          <PersonChip person={{ id: c.person.id, gender: c.person.gender, names: c.person.names }} treeId={treeId} />
                          {c.roles.map((r) => (
                            <span key={r} className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                              {r.replace(/-/g, " ")}
                            </span>
                          ))}
                          {c.reciprocated && (
                            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                              both say so
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                          {c.memories} shared {c.memories === 1 ? "memory" : "memories"}
                          {c.lastInteractionAt ? ` · last ${formatRelDays(c.lastInteractionAt)}` : ""}
                          {c.score ? ` · closeness ${c.score}` : ""}
                        </div>
                        {(c.origin.text || c.origin.via || c.origin.context) && (
                          <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                            {c.origin.via ? `Through ${displayName(c.origin.via.names)}` : "How it started"}
                            {c.origin.context ? ` · ${c.origin.context.replace(/-/g, " ")}` : ""}
                            {c.origin.at ? ` · ${c.origin.at}` : ""}
                            {c.origin.text ? ` — ${c.origin.text}` : ""}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    No one in the circle yet. Add a shared memory or name a tie above.
                  </p>
                )}

                {friendLinks.length > 0 && (
                  <div>
                    <h4 className="font-medium">From other families</h4>
                    <ul className="mt-2 flex flex-col gap-2">
                      {friendLinks.map((f) => (
                        <li key={f.linkId} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--hairline)" }}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{displayName(f.person.names)}</span>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>· {f.familyName}</span>
                            {f.roles.map((r) => (
                              <span key={r} className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                                {r.replace(/-/g, " ")}
                              </span>
                            ))}
                            {f.reciprocated && (
                              <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                                both say so
                              </span>
                            )}
                          </div>
                          {(f.originText || f.originContext) && (
                            <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                              {f.originContext ? f.originContext.replace(/-/g, " ") : "How it started"}
                              {f.originText ? ` — ${f.originText}` : ""}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {editable && myFriendPending.length > 0 && (
                  <div>
                    <h4 className="font-medium">Friend invites out</h4>
                    <ul className="mt-2 flex flex-col gap-2 text-sm">
                      {myFriendPending.map((f) => {
                        const url = `${origin}/f/${f.token}`;
                        return (
                          <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: "var(--hairline)" }}>
                            <span className="font-medium">{f.inviteeName}</span>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>{f.roleHint.replace(/-/g, " ")} · pending</span>
                            <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">{url}</code>
                            <CopyButton value={url} label="Copy" />
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(`Hi ${f.inviteeName} — start your own family tree and connect with mine: ${url}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                              style={{ background: "#25D366" }}
                            >
                              WhatsApp
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {relMemories.length > 0 && (
                  <div>
                    <h4 className="font-medium">Memories</h4>
                    <ul className="mt-2 flex flex-col gap-2">
                      {relMemories.map((m) => (
                        <li key={m.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--hairline)" }}>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-medium">{m.title}</span>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>
                              {[m.dateText, m.place?.title].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                          {m.body && <p className="mt-1 whitespace-pre-wrap">{m.body}</p>}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {m.participants.map((p) => (
                              <span key={p.personId} className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                                {displayName(p.person.names)}{p.confirmedAt ? " ✓" : ""}
                              </span>
                            ))}
                          </div>
                          {m.participants.filter((p) => p.note).map((p) => (
                            <p key={p.personId} className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                              <span style={{ color: "var(--fg)" }}>{displayName(p.person.names)}:</span> {p.note}
                            </p>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}

/** "3 days ago" / "2 months ago" — coarse, for the circle "last" hint. */
function formatRelDays(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
