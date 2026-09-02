# Relationship rules — how Identities connect

Design #2 of 4. Depends on [identity-model.md](identity-model.md). See also
[relationships-layer.md](relationships-layer.md) — the existing "relationships as accrued
shared history" work (`Memory`, `RelationEdge`, `SelfNode`) — which this extends, not
replaces.

## Three kinds of tie, never conflated

| Kind | What it means | Where it's recorded today | Where it's recorded going forward |
|---|---|---|---|
| **Blood / lineage** | parent↔child, sibling (derived from shared parents) | `Family` + `ChildRef`, tree-local | unchanged — stays tree-local `Family`/`ChildRef`. Never modeled as an `IdentityRelationship`. |
| **Marriage / in-law** | partners in a union, and the family-to-family tie it creates | `Family.partner1Id`/`partner2Id`, tree-local | tree-local `Family` **plus** a global `IdentityRelationship(kind=MARRIAGE)` once both partners have Identities |
| **Chosen / social** | friend, mentor, chosen-sibling, community tie — *not* a family member | `RelationEdge` (same tree) / `FriendLink` (cross-tree) | global `IdentityRelationship(kind=CHOSEN)` |

**Rule: a friend never becomes a family member by accident.** `IdentityRelationship.kind`
is a closed enum (`BLOOD_ECHO | MARRIAGE | CHOSEN`) and nothing promotes a `CHOSEN` edge to
`MARRIAGE`/`BLOOD_ECHO` automatically — that requires a new, explicit event (a marriage
event, a birth event) recorded the normal way in some Tree, same as today.

## Why blood ties are *not* stored again at the Identity level

Blood descent (parent/child, and derived sibling/cousin/etc.) is exactly recorded once
already, inside the Tree that has the family unit: `Family` + `ChildRef`. Duplicating that
as a global edge would create two sources of truth that can drift. Instead:

- The Identity graph **reads** blood relationships by walking `Person.identityId` links out
  of each tree's `Family`/`ChildRef` rows. A "how is Billy related to Amina" query resolves
  by: find Billy's Identity → find every Person linked to it → walk each one's tree-local
  `Family`/`ChildRef` → map each relative Person back to *its* Identity (if linked) → repeat.
- This is why linking Person → Identity matters even when nobody explicitly records
  "these two are related": once both a parent's Person and a child's Person are linked to
  Identities, the parent/child tie is visible globally for free, with no separate edge to
  keep in sync.
- A cached `IdentityRelationship(kind=BLOOD_ECHO)` row is written **only as a read
  optimization** (avoid re-walking the graph on every query) — it is always derived, never
  hand-edited, and is regenerated whenever the underlying `Family`/`ChildRef`/`identityId`
  links change. If it and the tree data ever disagree, the tree data wins.

## Why marriage *is* stored again at the Identity level

Marriage is the one blood-graph-adjacent fact that crosses tenancy boundaries by nature —
it's the literal moment two family networks connect. Unlike parent/child (which is legible
by walking one tree), "who did Billy marry" may point at a Person that only exists in a
*different* tree, owned by a different Workspace, that Billy's tree has no read access to.
So marriage needs its own first-class, non-derived edge:

```prisma
enum IdentityRelationshipKind {
  BLOOD_ECHO   // cached/derived — see above, never hand-authored
  MARRIAGE     // explicit, hand-authored via a claim/verification flow
  CHOSEN       // explicit, hand-authored — friend/mentor/community, from RelationEdge/FriendLink
}

enum IdentityRelationshipStatus {
  PROPOSED     // one side asserted it; not yet corroborated
  CONFIRMED    // both sides' claimed users confirmed, or a tree admin verified it
  DISPUTED     // a party flagged it as wrong; hidden from public graph pending review
}

model IdentityRelationship {
  id          String                     @id @default(cuid())
  aIdentityId String                     // canonical order: aIdentityId < bIdentityId
  bIdentityId String
  kind        IdentityRelationshipKind
  status      IdentityRelationshipStatus @default(PROPOSED)
  /// which Family/ChildRef row this was sourced from, when derived (BLOOD_ECHO) or
  /// when a MARRIAGE was entered as a Family event and then echoed up
  sourceTreeId   String?
  sourceFamilyId String?
  assertedById   String?   // User who proposed it
  confirmedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  aIdentity Identity @relation("IdentityRelA", fields: [aIdentityId], references: [id], onDelete: Cascade)
  bIdentity Identity @relation("IdentityRelB", fields: [bIdentityId], references: [id], onDelete: Cascade)

  @@unique([aIdentityId, bIdentityId, kind])
  @@index([aIdentityId])
  @@index([bIdentityId])
}
```

A `MARRIAGE` edge is created in one of two ways, never silently:

1. **Both partners already have Identities** (e.g. two existing members marry). Recording
   the marriage event in either tree's `Family` row triggers a `PROPOSED` edge; it becomes
   `CONFIRMED` when the other side's claimed user (or a tree admin with edit rights over
   that Identity's linked Person) acknowledges it. See
   identity-dedup-claim-workflow.md for the verification UI.
2. **One partner is new to the platform.** Their Tree's `Family` row is created as normal
   (tree-local, unlinked Person). The Identity-level `MARRIAGE` edge is only proposed once
   that new Person goes through deep search / claim (see onboarding-state-machine.md) and
   picks up an `identityId` — so an unlinked stub spouse never silently connects two family
   networks. Family-to-family bridging is opt-in, not automatic on data entry.

## Reciprocity and disagreement

Following the existing pattern from `RelationAssertion`/`FriendLinkAssertion`: a
relationship can be `PROPOSED` by one side and sit that way indefinitely — a Tree keeps
working normally with a proposed-but-unconfirmed marriage edge, exactly as it works today
with an unclaimed Person. Nothing about editing your own tree ever blocks on the other
family confirming. Confirmation only affects whether the edge is used to bridge cross-tree
visibility (deep search results, relationship-path display) — never whether either tree's
own data is usable.

`DISPUTED` exists for the case two families genuinely disagree ("that's not who my
grandfather married") — it hides the edge from cross-tree bridging without deleting it, and
surfaces it to both sides' tree admins the same way an `EventComment` does today.

## Chosen ties stay exactly as designed

No changes to the semantics in [relationships-layer.md](relationships-layer.md): a
`RelationEdge`/`FriendLink` chosen tie is never treated as kinship, never appears in a
pedigree/descendant chart, and its `score` (recency + volume + reciprocity of shared
`Memory` rows) is unaffected by whether either side has an Identity yet. The only change:
once both sides of a `FriendLink` have Identities, a mirroring
`IdentityRelationship(kind=CHOSEN)` is written so the tie is visible from the Identity graph
too (e.g. "how do I know Amina" resolving to "chosen — met through my father" even from a
tree that isn't the one where the `FriendLink` lives). Existing `FriendLink` rows are
backfilled opportunistically as their Person rows get linked to Identities — no bulk
migration required.
