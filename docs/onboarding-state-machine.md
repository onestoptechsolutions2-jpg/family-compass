# Onboarding state machine — deep search before a new Identity

Design #3 of 4. Depends on [identity-model.md](identity-model.md) and
[identity-dedup-claim-workflow.md](identity-dedup-claim-workflow.md) (matching/claim
mechanics referenced but specified there).

## Today's flow (why it must change)

`ensurePersonalWorkspace()` runs on first sign-in and unconditionally creates a new
`Workspace` + `Tree` for the user, with no identity search at all. `DeepSearch` exists
today only as a **paid, post-onboarding** feature reachable from `/discover` — a signed-in
user with an existing tree searching for *other* people. There is no point in the flow
where a brand-new user is asked "are you already in someone's tree?" before we hand them a
blank one. That's the gap this state machine closes.

## Principle

**A new Identity is a last resort, not a default.** Every new sign-in passes through a
mandatory, free identity search before any Person/Tree is created for them. Paid
`DeepSearch` (searching for *other* people, from `/discover`) is unchanged and unaffected by
this — this is specifically the self-identity check at signup.

## States

```
UNAUTHENTICATED
      │ signs in (Auth.js — unchanged)
      ▼
NEEDS_IDENTITY_SEARCH ──────────────────────────────────────────┐
      │ runs mandatory self-search (name, birth year, clan,     │
      │ community, region, known relatives — free, not the      │
      │ paid /discover flow)                                    │
      ▼                                                          │
   ┌──────────────────┴──────────────────┐                       │
   │                                      │                       │
NO CANDIDATES                    CANDIDATES FOUND                 │
   │                                      │                       │
   ▼                                      ▼                       │
CONFIRM_NO_MATCH                   REVIEWING_CANDIDATES            │
 (explicit "none of these          │  user picks one, or          │
  are me" — not a silent            "none of these are me"         │
  default; see note below)         │                               │
   │                                ├─────────────┐                │
   │                          picks a candidate    picks none       │
   │                                ▼             (→ CONFIRM_NO_MATCH)
   ▼                          CLAIM_REQUESTED                       │
NEW_IDENTITY_CREATED                │  (PersonClaim-style, see      │
 (Identity + personal               │   identity-dedup-claim-       │
  Workspace + Tree + self           │   workflow.md — needs         │
  Person created together,          │   verification, is never      │
  Person.identityId set             │   auto-approved)               │
  immediately — no orphan            │                                │
  unlinked stub for yourself)        ├───────────────┬───────────────┘
   │                             VERIFIED         REJECTED
   │                                 │                │
   │                                 ▼                ▼
   │                        IDENTITY_CLAIMED    back to REVIEWING_CANDIDATES
   │                        (existing Identity   (or CONFIRM_NO_MATCH if no
   │                         .claimedByUserId     candidates left)
   │                         set; a NEW personal
   │                         Workspace/Tree is
   │                         still created — see
   │                         note below — with its
   │                         self Person linked to
   │                         the claimed Identity)
   │                                 │
   └────────────────┬────────────────┘
                     ▼
                  ACTIVE
        (normal signed-in member; guided-steps
         checklist, tree building, etc. — unchanged)
```

## Notes on specific transitions

**Why "confirm no match" is an explicit step, not a default.** Silently defaulting to "no
match, create new" whenever the user doesn't pick a candidate would recreate exactly the
duplication problem this whole layer exists to prevent — impatient users skimming past a
real match. The UI must require a deliberate action (a "none of these are me" click, not a
skip/timeout) before `NEW_IDENTITY_CREATED` is reachable.

**Why a claimed Identity still gets its own new Workspace/Tree.** Claiming an Identity means
"I am this real human," not "I inherit someone else's family's data." The person who
invited/entered you doesn't lose editing rights over their tree, and you don't get silent
write access to it either — claiming only sets `Identity.claimedByUserId` and links your new
Tree's self-`Person` to that Identity. From there the two family's trees are bridgeable
(their Person for you, your Person for you, same Identity) but each Workspace keeps its own
privacy/edit boundary, same as today. If the inviting family wants to grant you editor
rights on *their* tree, that's the existing `Membership`/`Invitation` flow, unchanged and
separate from claiming.

**What the mandatory self-search actually queries.** Reuses the existing
`searchDirectory()`/`teaserRows()` machinery from `/discover` (name, clan, community,
region, birth year) but is gated differently: free (no `Payment`/`PaymentKind.DEEP_SEARCH`),
mandatory (can't be skipped), and its output feeds `IdentityCandidate` scoring (see
identity-dedup-claim-workflow.md) rather than paid teaser rows. It should also accept
"named by a relative" — if someone invited this user via `ClaimInvite`/`FriendInvite`/a
memorial contributor link, that referral is itself a high-confidence candidate and should be
surfaced first, before a blind name search.

**Living vs. deceased asymmetry.** This entire state machine is for a *living* person
onboarding themself. Deceased people never pass through it — their Identity (if any) is
created by whoever enters them, exactly as `Person` rows are created unclaimed today.
Identity linking for the deceased happens entirely through the merge workflow
(identity-dedup-claim-workflow.md), triggered by a family member noticing "this is the same
grandfather my cousin already entered," never through self-service onboarding.

**Idempotency.** `ACTIVE` is a stable end state. A returning user who already has an
Identity (claimed or not) skips straight from `UNAUTHENTICATED` to `ACTIVE` — the search only
runs once, on the sign-in where no `User.claimedPerson`/Identity link exists yet. This
mirrors `ensurePersonalWorkspace()`'s existing idempotency check (`Membership` with
`role: OWNER`), extended to check for an Identity claim first.

## What is explicitly out of scope for this doc

- The matching/scoring algorithm behind `CANDIDATES FOUND` — identity-dedup-claim-workflow.md.
- The verification mechanics behind `CLAIM_REQUESTED → VERIFIED` — identity-dedup-claim-workflow.md.
- Any UI copy/screens — this is the state machine only, per the instruction to design before
  implementing UI.
