# Deduplication, claim & merge workflow

Design #4 of 4. Depends on [identity-model.md](identity-model.md),
[relationship-rules.md](relationship-rules.md),
[onboarding-state-machine.md](onboarding-state-machine.md).

## Hard rule: no automatic destructive merging, ever

Every operation below either (a) proposes a link that a human confirms, or (b) is fully
reversible. Nothing in this workflow deletes a `Person` row, rewrites another family's
facts, or silently grants cross-tree access. The worst-case failure mode of a wrong match is
"two Identities that should be one stay two, and someone has to notice" — never "two
different real humans got collapsed into one, or a family's private data leaked."

## Three operations, kept distinct

| Operation | What it does | Who can do it | Reversible? |
|---|---|---|---|
| **Match** | scoring engine surfaces *candidate* Identities for a Person — a suggestion only | system, automatic | N/A — no state change |
| **Claim** | a specific `Person`/`Identity` pair is proposed as "same human," pending verification | any signed-in user (for themself, via onboarding) or a tree admin (for a relative) | yes — reject/undo before confirmation; see below |
| **Merge** | two *already-separate* Identities (each with their own linked People, both previously created independently) are combined into one | a tree admin on **both** sides, or platform support, after both claims are independently confirmed | yes, within a grace window — see below |

Claim is the common case (linking a fresh, unlinked Person to an existing Identity — nothing
to merge because nothing was duplicated yet). Merge is the recovery case — two Identities
that shouldn't have both existed, discovered after the fact.

## 1. Matching — scoring, not fuzzy string matching alone

Extends the existing `searchDirectory()` (used by both `/discover` and the mandatory
onboarding search). For a query person (their name, birth year hint, gender, clan,
community, region, and — highest signal — any known relatives already linked to
Identities), score every candidate `Identity` (via its linked `Person` rows across all
trees the directory is allowed to search):

```
score = nameSimilarity        (0–40)   // normalized name match, not exact-string
      + birthYearProximity    (0–20)   // exact=20, ±2y=10, ±5y=5, unknown=0 (neutral, not penalized)
      + clanOrCommunityMatch  (0–15)
      + regionMatch           (0–10)
      + relativeOverlap       (0–40)   // candidate shares a CONFIRMED IdentityRelationship
                                        // with someone the query person already named as a
                                        // relative — by far the strongest signal, can alone
                                        // push a weak name match into "likely"
```

Presented to the user in three tiers, never as a single silent auto-pick:

- **`score ≥ 70`** → "likely you" — shown first, pre-selected but still requires an explicit
  tap to claim.
- **`30 ≤ score < 70`** → "possible matches" — shown as a scrollable list, no pre-selection.
- **`score < 30`** → not shown at all (reduces noise; these are search-result quality, not
  identity signal).

`relativeOverlap` is why the onboarding search should ask "who are your parents/spouse, if
you know they're already on the platform" — one confirmed relative match is worth more than
a strong name match alone, and is exactly the "different family lines connect through
marriage" case the whole layer exists for.

Directory scope respects existing `Tree.discoverable`/privacy rules unchanged — matching
never surfaces a Person from a non-discoverable tree; it can still *exist* as a candidate for
scoring but is shown to the searcher only as much as `/discover`'s existing teaser-row
redaction already allows (name + rough clan/decade, no contact info, no tree link) until a
claim is filed and verified.

## 2. Claim — extends `PersonClaim`, generalized to also target an Identity

Today's `PersonClaim` is tree-scoped: `treeId` + optional `personId`, verified out-of-band
(WhatsApp code), decided by a tree editor. Extend it rather than replace it:

```prisma
model PersonClaim {
  // ...existing fields unchanged...
  targetIdentityId String?   // NEW — set when this claim targets an existing global
                              // Identity (self-claim at onboarding, or a relative claiming
                              // someone else's already-linked kin) rather than only a
                              // tree-local Person
}
```

Two shapes of claim, same table:

- **Self-claim** (onboarding). `claimantName`/`phone` is the signed-in user themself.
  `personId` may be null (they have no tree-local Person yet — one is created alongside).
  `targetIdentityId` set to the matched candidate. Verification: since this is the platform's
  own signed-in user claiming to *be* someone, the bar is higher than a WhatsApp code —
  require at minimum a phone number match against a `Name`/`Attribute` already on file for
  that Identity's linked People, or a code sent to a phone number a tree admin already has on
  record for that unclaimed Person. If neither is available, fall back to the existing
  human-verification path: the claim sits `PENDING` until a tree admin on the matched side
  approves it, exactly like today's out-of-band `PersonClaim` review.
- **Relative-claim** ("this Person I just entered is the same as that Person my cousin's
  tree has"). Filed by a tree admin, not a random visitor. `personId` = the newly-entered
  Person, `targetIdentityId` = the candidate. Decided by an admin **on the other side**
  (the tree that owns the matched Identity's existing linked Person) — never unilaterally by
  the person filing the claim, since they don't own that data.

On `APPROVED`: set `Person.identityId = targetIdentityId` (or create a new `Identity` and
set both sides' `identityId` to it, if this was the first-ever claim for that person). No
other row is touched — no facts copied, no privacy setting changed, no cross-tree access
granted. Linking is metadata only.

## 3. Merge — the recovery path for two Identities that turn out to be one

This only exists because Claim can't catch every case up front (two families each
independently created an unlinked Person for the same ancestor years apart, neither ever
searched). When someone notices ("wait, my Identity #A12 and my cousin's Identity #B77 are
both grandma"):

1. **Propose.** Either side's tree admin files a merge proposal:
   `IdentityMergeRequest { fromIdentityId, intoIdentityId, proposedById, evidence }`.
   `evidence` is free text + optionally attached `Citation`/`MediaObject` references — same
   evidentiary bar as any other genealogical fact.
2. **Corroborate.** Requires approval from a manager of **every Tree** that has a Person
   linked to `fromIdentityId` — not just one, and tracked per-Tree (`IdentityMergeApproval`)
   rather than per-Workspace: Tree is this app's actual admin boundary (`Tree.adminUserId`,
   `requireTreeManage`) since one Workspace can hold several trees with different admins. If
   `fromIdentityId` has only ever had one linked Person (the common case — an unclaimed
   duplicate nobody built on yet), only that one tree's manager needs to approve. Any required
   tree can veto instead (`REJECTED`), ending the request outright.
3. **Execute** (automatically, the moment the last required approval lands — not a separate
   manual trigger): re-point every `Person.identityId` that pointed at `fromIdentityId` to
   `intoIdentityId`; re-point every `IdentityRelationship` the same way (deduplicating if
   `intoIdentityId` already had the same relationship, keeping the higher-status one on
   conflict — `CONFIRMED` beats `PROPOSED` beats `DISPUTED` — and dropping a relationship that
   would now point an Identity at itself); if `fromIdentityId` was claimed and
   `intoIdentityId` wasn't, the claim moves across (two *different* claiming accounts on both
   sides is refused at proposal time, before any approval — that needs a human, not this
   workflow); soft-delete `fromIdentityId` (`mergedIntoId` set, row kept, never hard-deleted)
   rather than removing it, so old links/URLs that referenced it can redirect.
4. **Grace window.** For 14 days after execution, the merge is fully reversible by any Tree
   manager who approved it — a single action restores `fromIdentityId`, every repointed
   Person/`IdentityRelationship` row, and any transferred claim to its pre-merge state, from
   an `IdentityMergeRequest.snapshot` taken at execution time. After 14 days the snapshot is
   dropped and the merge is final (matching the pattern of other time-boxed reversibility
   already in the schema, e.g. `Memorial`'s lock/unlock and `ClaimInvite.expiresAt`).

**What merge never does:** it never touches `Person` rows' own facts (names, events, media,
privacy) — those stay exactly as each family recorded them, forever, even after their Person
rows point at the same Identity. Two families are allowed to disagree about grandma's birth
year in their own trees; the Identity layer records that they're talking about the same
grandma, not whose version of her biography is correct.

## Audit trail

Every Claim decision and every Merge step writes an `AuditLog` row (existing model, already
generic — `targetType: "PersonClaim" | "IdentityMergeRequest"`), same as claim decisions do
today. This is the record that lets a wrongly-approved claim or merge be investigated and,
within the grace window, undone.
