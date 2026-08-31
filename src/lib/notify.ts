import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import type { EventName } from "@/lib/events-catalog";

type NotifyInput = {
  kind: EventName | (string & {});
  title: string;
  body?: string | null;
  linkPath?: string | null;
  workspaceId?: string | null;
  treeId?: string | null;
};

/** In-app notification for one user. Never throws. */
export async function notifyUser(userId: string, n: NotifyInput): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId,
        workspaceId: n.workspaceId ?? null,
        treeId: n.treeId ?? null,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 1000) ?? null,
        linkPath: n.linkPath ?? null,
      },
    });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

async function fanOut(userIds: string[], n: NotifyInput): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  try {
    await db.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        workspaceId: n.workspaceId ?? null,
        treeId: n.treeId ?? null,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 1000) ?? null,
        linkPath: n.linkPath ?? null,
      })),
    });
  } catch (err) {
    console.error("[notify] fan-out failed", err);
  }
}

/** Notify every EDITOR/OWNER member of the tree's workspace. */
export async function notifyTreeManagers(
  treeId: string,
  n: Omit<NotifyInput, "treeId" | "workspaceId">,
  opts: { exceptUserId?: string } = {},
): Promise<void> {
  try {
    const tree = await db.tree.findUnique({
      where: { id: treeId },
      select: {
        workspaceId: true,
        workspace: {
          select: {
            memberships: {
              where: { role: { in: [Role.EDITOR, Role.OWNER] } },
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!tree) return;
    const ids = tree.workspace.memberships
      .map((m) => m.userId)
      .filter((id) => id !== opts.exceptUserId);
    await fanOut(ids, { ...n, treeId, workspaceId: tree.workspaceId });
  } catch (err) {
    console.error("[notify] notifyTreeManagers failed", err);
  }
}

/** Notify every OWNER of a workspace. */
export async function notifyWorkspaceOwners(
  workspaceId: string,
  n: Omit<NotifyInput, "workspaceId">,
  opts: { exceptUserId?: string } = {},
): Promise<void> {
  try {
    const members = await db.membership.findMany({
      where: { workspaceId, role: Role.OWNER },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId).filter((id) => id !== opts.exceptUserId);
    await fanOut(ids, { ...n, workspaceId });
  } catch (err) {
    console.error("[notify] notifyWorkspaceOwners failed", err);
  }
}

/** Notify every platform admin (isPlatformAdmin). Used for system alerts. */
export async function notifyPlatformAdmins(
  n: Omit<NotifyInput, "workspaceId" | "treeId">,
): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: { isPlatformAdmin: true },
      select: { id: true },
    });
    await fanOut(admins.map((a) => a.id), n);
  } catch (err) {
    console.error("[notify] notifyPlatformAdmins failed", err);
  }
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  try {
    return await db.notification.count({ where: { userId, readAt: null } });
  } catch {
    return 0;
  }
}
