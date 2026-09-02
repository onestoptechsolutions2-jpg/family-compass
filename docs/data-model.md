# Data model — terms & grouping

The schema follows the **Gramps / GEDCOM** object model. Some words mean
something narrower here than in everyday speech — this file pins them down so
contributors don't re-overload them. Table names stay as Gramps has them;
**UI labels** are chosen for lay users.

## Core objects

| Term | It is | Not |
|---|---|---|
| **Person** | one human. Identity is their `Name` rows (one `preferred`). | — |
| **Family** *(table)* — shown in the UI as **"Family unit"** | a **union**: 0–2 partners of a couple **plus the children they share** (`ChildRef`). GEDCOM `FAM`, Gramps `family`. A one-parent unit is valid (`partner2Id` null); a zero-parent unit is rejected. | "the whole family" / "the Otieno family". |
| **ChildRef** | a Person's membership in a Family **as a child**, with the relationship to each parent — `partner1Relation` / `partner2Relation` ∈ `BIRTH · ADOPTED · STEPCHILD · FOSTER · SPONSORED · UNKNOWN`. Step / half / foster relationships are read from these fields, not guessed from structure. | — |
| **Event** | a dated, placed occurrence (Birth, Marriage, Death, …). Attached to a Person or a Family via `EventRef`. Recording a **Marriage** event sets `Family.type = MARRIED` when it was `UNKNOWN`, so the two never contradict. | — |
| **Tree** | one genealogical dataset. Has one keeper `Workspace` and one **family admin** (`Tree.adminUserId`) who manages its claims / sharing / requests. | — |
| **Namesake** | `Person.namedAfterId` — the relative a person was named for (a common Kenyan custom, usually a grandparent). Informational, not a lineage link; `namesakes` is the reverse. | a parent / clan link. |

## Grouping — "a group of families makes a …?"

```
Person
  └─ member of ─ Family (a union / conjugal unit)
        └─ connected via ChildRef + partner edges into a
              Lineage  ── a surname line + descent path. DERIVED, not a row.
                    └─ tagged to a
                          Clan  ── a named descent group above the lineage.
                                   An ENTITY: Person.clanId + Person.subClan,
                                   reference list in ReferenceClan.
                                └─ part of a
                                      Community  ── ethnic / cultural group of
                                                    clans. A LABEL only
                                                    (Tree.community,
                                                     ReferenceClan.community).
```

### Inheritance down a lineage

Clan is **patrilineal by default** (`Tree.clanInheritance` ∈ `PATRILINEAL ·
MATRILINEAL · NONE`; `Tree.inheritSurname` also copies the family name):

- **Adding a child / a parent** fills the child's *blank* `clanId` / `subClan`
  (and surname) from the lineage parent — `applyLineageInheritance()`.
- **Correcting a person's clan** flows down the line — `cascadeClanDown()`
  updates every descendant whose value was blank *or still equal to the old
  clan*, and stops at a daughter's children (they carry their own father's
  clan). An explicitly different clan on a descendant is left alone.
- **Clan-level facts** (community/tribe, totem, origin) live once on the shared
  `Clan` row, so fixing them there updates everyone by reference.
- **Backfill** (tree Settings → Clan & naming) applies the rule to people
  already in the tree.

Orthogonally: every Person lives in exactly one **Tree**. Trees join to each
other only through **`FriendLink`** (a chosen / cross-tree tie between two
Persons in different Trees). The research graph is **⋃ Trees ∪ FriendLinks** —
there is deliberately no "these N trees are one extended family" entity;
that grouping is emergent from the friend-link graph.

## Deliberately not modelled (yet)

- **Lineage as a table** — while lineage = surname + clan is enough. Add an
  optional `Lineage` row only when a research question needs "size of the
  Sakwa lineage across trees".

## Identity layer (design, not yet implemented)

The "deliberately no family-group-of-trees entity" note above predates a 2026-09-02
decision to add exactly that, scoped narrowly: a global **Identity** record above
tree-scoped `Person`, so the same real human isn't re-entered as a duplicate `Person`
when two family trees connect through marriage. `Tree`/`Workspace` remain the privacy,
billing and editing boundary — Identity only records "these Person rows, across
however many trees, are the same human." See:

- [identity-model.md](identity-model.md) — Identity vs Person vs Relationship vs Tree
- [relationship-rules.md](relationship-rules.md) — blood / marriage / chosen ties, kept distinct
- [onboarding-state-machine.md](onboarding-state-machine.md) — mandatory deep search before a new Identity
- [identity-dedup-claim-workflow.md](identity-dedup-claim-workflow.md) — matching, claim, and (non-destructive, reversible) merge
