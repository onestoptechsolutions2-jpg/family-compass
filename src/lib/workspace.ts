import { db } from "@/lib/db";
import { slugify, randomToken } from "@/lib/slug";
import { Role } from "@prisma/client";

/**
 * Every user gets one personal workspace they OWN on first sign-in.
 * Idempotent — safe to call repeatedly.
 */
export async function ensurePersonalWorkspace(userId: string, displayName: string) {
  const existing = await db.membership.findFirst({
    where: { userId, role: Role.OWNER },
    select: { id: true },
  });
  if (existing) return;

  const base = slugify(displayName) || "family";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await db.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) break;
    slug = `${base}-${randomToken(4)}`;
  }

  await db.workspace.create({
    data: {
      name: `${displayName.split(" ")[0] ?? displayName}'s Family`,
      slug,
      memberships: { create: { userId, role: Role.OWNER } },
    },
  });
}

/** The user's own workspace id (creates one if missing). */
export async function personalWorkspaceId(userId: string, displayName = "My"): Promise<string> {
  const owned = await db.membership.findFirst({
    where: { userId, role: Role.OWNER },
    select: { workspaceId: true },
  });
  if (owned) return owned.workspaceId;
  await ensurePersonalWorkspace(userId, displayName);
  const created = await db.membership.findFirstOrThrow({
    where: { userId, role: Role.OWNER },
    select: { workspaceId: true },
  });
  return created.workspaceId;
}
