import { cache } from "react";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { touchSession } from "@/lib/session";
import { roleAtLeast, canEdit, canManageTree, canManageWorkspace, canEditPersonRecord } from "@/lib/rbac-rules";

export { roleAtLeast, canEdit, canManageTree, canManageWorkspace, canEditPersonRecord };

export class AccessError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isPlatformAdmin: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  await touchSession();
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    isPlatformAdmin: session.user.isPlatformAdmin ?? false,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/app");
  return user;
}

export type TreeContext = {
  user: SessionUser;
  workspace: { id: string; name: string; slug: string };
  tree: {
    id: string;
    name: string;
    slug: string;
    homePersonId: string | null;
    /** the designated family admin for this tree (may be null) */
    familyAdminId: string | null;
  };
  /** this user is the family admin for the tree (own-tree manage rights) */
  isFamilyAdmin: boolean;
  role: Role;
};

/**
 * Loads a tree the current user can access and returns their role in it.
 * Throws AccessError (caught by route handlers) or redirects (server components
 * via requireUser).
 */
export const loadTreeContext = cache(async function loadTreeContext(
  treeId: string,
): Promise<TreeContext> {
  const user = await requireUser();

  const baseSelect = {
    id: true,
    name: true,
    slug: true,
    homePersonId: true,
    workspace: {
      select: {
        id: true,
        name: true,
        slug: true,
        memberships: {
          where: { userId: user.id },
          select: { role: true },
        },
      },
    },
  } as const;

  // `adminUserId` (migration …032). If the deploy hasn't run migrations yet,
  // don't take every tree page down — just run without the family-admin bit.
  const load = async () => {
    try {
      return await db.tree.findUnique({
        where: { id: treeId },
        select: { ...baseSelect, adminUserId: true },
      });
    } catch {
      const b = await db.tree.findUnique({ where: { id: treeId }, select: baseSelect });
      return b ? { ...b, adminUserId: null as string | null } : null;
    }
  };
  const tree = await load();

  if (!tree) throw new AccessError(404, "Tree not found");
  const membership = tree.workspace.memberships[0];
  const isFamilyAdmin = (tree.adminUserId ?? null) === user.id;
  if (!membership && !isFamilyAdmin && !user.isPlatformAdmin) {
    throw new AccessError(403, "No access to this tree");
  }

  // The designated family admin manages their own tree even if their
  // workspace membership sits below EDITOR.
  let role = membership?.role ?? Role.OWNER;
  if (isFamilyAdmin && !roleAtLeast(role, Role.EDITOR)) role = Role.EDITOR;

  return {
    user,
    workspace: {
      id: tree.workspace.id,
      name: tree.workspace.name,
      slug: tree.workspace.slug,
    },
    tree: {
      id: tree.id,
      name: tree.name,
      slug: tree.slug,
      homePersonId: tree.homePersonId,
      familyAdminId: tree.adminUserId ?? null,
    },
    isFamilyAdmin,
    role,
  };
});

export async function requireTreeEdit(treeId: string): Promise<TreeContext> {
  const ctx = await loadTreeContext(treeId);
  if (!canEdit(ctx.role)) throw new AccessError(403, "Editing not allowed for your role");
  return ctx;
}

export async function requireTreeManage(treeId: string): Promise<TreeContext> {
  const ctx = await loadTreeContext(treeId);
  if (!canManageTree(ctx.role)) throw new AccessError(403, "Manager role required");
  return ctx;
}

/**
 * Editing a specific person's own profile facts (name, vitals, events, media)
 * is allowed for a manager of the tree, or for the person themself once
 * claimed — not for every CONTRIBUTOR/EDITOR by default. Most people in a
 * family tree are deceased relatives who can never claim their own profile,
 * so this only narrows who may edit an *already-claimed, living* person's
 * own record; it does not affect adding new people or building out family
 * structure (childRef/family edits), which stay under requireTreeEdit.
 */
export async function requireEditPerson(treeId: string, personId: string): Promise<TreeContext> {
  const ctx = await loadTreeContext(treeId);
  const person = await db.person.findFirst({ where: { id: personId, treeId }, select: { claimedByUserId: true } });
  if (!person) throw new AccessError(404, "Person not found");
  if (!canEditPersonRecord(ctx.role, person.claimedByUserId, ctx.user.id)) {
    throw new AccessError(403, "Only this person or a tree manager can edit this profile");
  }
  return ctx;
}
