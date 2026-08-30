/**
 * Canonical catalogue of domain events. One source of truth for:
 *  - the notification engine (`src/lib/notify.ts`)
 *  - outbound webhooks (`src/lib/webhooks.ts`)
 *  - the integration docs (`/docs`) and the developer settings UI
 *
 * Event names are `noun.verb`, past tense, stable. Never rename one — add a new
 * name and keep emitting the old alongside it for a deprecation window.
 */
export const EVENTS = {
  "person.created": "A person was added to a tree.",
  "person.updated": "A person's core details or events changed.",
  "person.deleted": "A person was removed from a tree.",
  "person.event_recorded": "A life event (Birth, Death, Burial, Baptism, Graduation, …) was recorded on a person.",
  "person.privacy_changed": "A person's public visibility was changed (public / limited / hidden), optionally cascaded to descendants.",
  "family.created": "A family (couple / parent unit) was created.",
  "memorial.published": "A memorial page went live (published toggled on).",
  "memorial.updated": "A published memorial's tribute or programme changed.",
  "memorial.contribution_received": "An invited contributor submitted a memory, life detail, date correction or photos to a memorial.",
  "memorial.tribute_left": "Someone left a flower / candle / wreath tribute on a public memorial.",
  "guestbook.created": "Someone signed a memorial guestbook (pending or approved).",
  "anniversary.upcoming": "A birthday, or a death or wedding anniversary, is within the next 7 days (emitted once per occasion per year by the daily scan).",
  "chama.created": "A family welfare / savings group (chama) was created for a tree.",
  "chama.fund_opened": "A collection drive was opened in a chama (e.g. a funeral welfare fund linked to a memorial).",
  "chama.contribution_pledged": "A supporter recorded a contribution to a chama fund (awaiting the treasurer's confirmation).",
  "chama.contribution_confirmed": "The treasurer confirmed a chama contribution against the M-Pesa statement.",
  "chama.fund_closed": "A chama collection drive was closed; `data.confirmedKes` is the confirmed total.",
  "claim.requested": "A relative asked to claim an existing profile as themselves.",
  "claim.approved": "A profile claim was approved and linked to an account.",
  "claim.rejected": "A profile claim was declined.",
  "invitation.accepted": "An invited person joined the workspace.",
  "payment.recorded": "A payment was submitted and is awaiting verification.",
  "payment.verified": "A payment was verified; credits / unlock granted.",
  "payment.rejected": "A payment was rejected.",
  "generation.preview_ready": "A watermarked preview of a paid export is ready.",
  "generation.output_ready": "A paid export was unlocked and the clean file is ready.",
} as const;

export type EventName = keyof typeof EVENTS;

export const EVENT_NAMES = Object.keys(EVENTS) as EventName[];

export function isEventName(v: string): v is EventName {
  return v in EVENTS;
}

/** Expand a subscription list (which may contain "*") to concrete matches. */
export function subscriptionMatches(subscribed: string[], event: EventName): boolean {
  return subscribed.includes("*") || subscribed.includes(event);
}
