import { Role } from "@prisma/client";

/**
 * Pure permission rules, kept free of Next.js/auth/DB imports so they're
 * unit-testable directly (see rbac-rules.test.ts) — rbac.ts re-exports these
 * and wraps them with the session/DB lookups a route actually needs.
 */

const RANK: Record<Role, number> = {
  VIEWER: 0,
  CONTRIBUTOR: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/** Can create/update/delete genealogy records in a tree. */
export const canEdit = (role: Role) => roleAtLeast(role, Role.CONTRIBUTOR);
/** Can manage sharing, imports, members, and paid generations. */
export const canManageTree = (role: Role) => roleAtLeast(role, Role.EDITOR);
/** Can rename/delete the workspace, manage billing settings. */
export const canManageWorkspace = (role: Role) => roleAtLeast(role, Role.OWNER);

/**
 * Editing a specific person's own profile facts (name, vitals, events,
 * media) is allowed for a manager of the tree, or for the person themself
 * once claimed — not for every CONTRIBUTOR/EDITOR by default. Most people in
 * a family tree are deceased relatives who can never claim their own
 * profile, so this only narrows who may edit an *already-claimed, living*
 * person's own record; it does not affect adding new people or building out
 * family structure (childRef/family edits), which stay under canEdit.
 * `role` is the caller's role as already resolved by loadTreeContext, which
 * promotes it to EDITOR when they're the tree's designated family admin —
 * so that case doesn't need repeating here.
 */
export function canEditPersonRecord(role: Role, claimedByUserId: string | null, userId: string): boolean {
  return canManageTree(role) || claimedByUserId === userId;
}
