# Identity model — one person, many trees

> **One Person. Many Relationships. Connected Family Networks. Trees are Views.**

This is design #1 of 4 for the Identity layer (see [relationship-rules.md](relationship-rules.md),
[onboarding-state-machine.md](onboarding-state-machine.md),
[identity-dedup-claim-workflow.md](identity-dedup-claim-workflow.md)). Nothing here is
implemented yet — no schema migration, no UI. This is the shape we agree on first.

## Why this exists

Today (see [data-model.md](data-model.md)) a `Person` row lives inside exactly one `Tree`,
and `Tree` is the tenancy boundary — it owns privacy, billing (`Workspace`), sharing links,
memorials, chama funds. Cross-tree ties are `FriendLink`, explicitly scoped to **chosen**
(non-blood) relationships. There is no entity for "this Person in Family A and that Person
in Family B are the same human" — so when two family lines connect through marriage, the
in-law's family either doesn't exist in your tree, or gets **re-entered as a duplicate**.

That's the gap. The fix is not to remove the Tree/Workspace boundary — it's doing real work
(privacy, billing, editing rights) and stays. The fix is a layer **above** Person that says
"these Person rows, across however many trees, are the same real human."

## The four concepts

```
IDENTITY  ── the real human. Global. Exists once. Not owned by any one Workspace.
    │
    ├── Person (Tree A) ── how this human appears/is recorded inside Family A's tree
    ├── Person (Tree B) ── how this human appears/is recorded inside Family B's tree
    └── Person (Tree C) ── an unclaimed stub someone else entered, not yet linked
                             ↑
                    RELATIONSHIP — how two Identities are connected
                    (blood, marriage/in-law, or chosen/friend — see relationship-rules.md)

TREE ── a Workspace-owned, privacy-scoped, billable dataset. A view/working-set over
         the graph, rooted at one or more Person rows it owns. NOT the human's identity.
```

- **Identity** — canonical row for one real human, living or dead. Exists independent of
  any tree. Has *at most one* claiming `User` (a living person who signs in as themself).
  Unclaimed identities (most historical/deceased people, and most living relatives who
  haven't joined yet) exist with no `User` attached — same as today's unclaimed `Person`.
- **Person** — unchanged in shape from today: a row inside one `Tree`, carrying the
  tree-local facts (names as *that family recorded them*, events, media, clan, privacy).
  New: an optional `identityId` pointing at the global Identity this Person represents.
  A Person with `identityId = null` is an **unlinked stub** — normal, not an error; most
  Person rows will stay unlinked until a deep search / claim / merge links them.
- **Relationship** — see relationship-rules.md. Family/marriage/friend ties are recorded
  **between Identities**, not between Person rows, so a tie survives regardless of how many
  trees each side's human appears in.
- **Tree** — unchanged in role: the editable, privacy-scoped, billed dataset a Workspace
  owns. What changes is what it *means*: a Tree is now understood as one **view** into the
  shared graph, seeded from one or more Identities, not a self-contained universe.

## Why Identity is separate from Person, not a replacement

Rejected alternative: make `Person` itself global (drop `treeId`). That was explicitly
turned down (see the tenancy-model decision recorded 2026-09-02) because almost every other
model — `Memorial`, `Payment`, `Chama`, `SharedView`, `Clan`, `RelationEdge`,
`PersonClaim` — keys off `treeId` for privacy and billing. Collapsing Person would mean
rewriting all of that at once, with no incremental path and no way to migrate existing
production data safely.

Keeping Person tree-scoped and adding Identity above it means:

- A family can keep recording their late grandmother's maiden-family details **their way**
  (their `Name`, their privacy settings, their photos) even if her Identity is also linked
  from her birth family's tree, recorded differently there. Person rows don't have to agree
  on facts — Identity just says "these are the same human," it doesn't force one canonical
  biography.
- Existing tenancy, billing, and privacy code needs **zero changes** to keep working. Identity
  is additive.
- Merge/dedup risk is contained: linking or unlinking a Person from an Identity never
  deletes or rewrites the Person row. See identity-dedup-claim-workflow.md for the merge
  rules (no automatic destructive merges, ever).

## Draft shape (design, not yet migrated)

```prisma
/// The real human. Global — not owned by a Workspace. Exists once regardless of how
/// many family trees have entered a Person for them.
model Identity {
  id            String   @id @default(cuid())
  claimedByUserId String? @unique   // set only when a living person claims themself
  /// best-known display name, for search/claim UI only — NOT a source of truth for
  /// any tree's biography. Each linked Person keeps its own Name rows.
  displayName   String?
  /// denormalized signals used by deep search matching — see identity-dedup-claim-workflow.md
  birthYearHint Int?
  genderHint    Gender?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  claimedBy     User?     @relation(fields: [claimedByUserId], references: [id], onDelete: SetNull)
  people        Person[]                 // every tree-scoped representation of this human
  relationshipsA IdentityRelationship[] @relation("IdentityRelA")
  relationshipsB IdentityRelationship[] @relation("IdentityRelB")
}

model Person {
  // ...unchanged fields...
  identityId String?
  identity   Identity? @relation(fields: [identityId], references: [id], onDelete: SetNull)

  @@index([identityId])
}
```

`IdentityRelationship` is specified in [relationship-rules.md](relationship-rules.md); the
claim/match/merge machinery (`IdentityCandidate`, extending `PersonClaim`) is specified in
[identity-dedup-claim-workflow.md](identity-dedup-claim-workflow.md).

## What does *not* change

- `Tree`, `Workspace`, `Membership`, `Role`, `Privacy`, billing, sharing, memorials, chama —
  all unchanged. They keep operating on Person/Tree exactly as today.
- `Family` (the union table) stays tree-scoped — it's how *this tree* records a marriage/
  parentage locally. `IdentityRelationship` is the global echo of a blood/marriage tie once
  at least one side is linked to an Identity; it doesn't replace `Family`/`ChildRef`.
- `FriendLink` stays as-is for chosen ties recorded before this layer existed, but new
  chosen ties should be recorded as `IdentityRelationship(kind=CHOSEN)` once both sides have
  Identities (see relationship-rules.md for the migration note).
