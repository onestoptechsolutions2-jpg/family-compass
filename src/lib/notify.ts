import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import type { EventName } from "@/lib/events-catalog";
import { sendPushToUser } from "@/lib/push";
import { sendEmail } from "@/lib/email";
import { hasEmailProvider } from "@/lib/env";
import { publicOrigin } from "@/lib/origin";

type NotifyInput = {
  kind: EventName | (string & {});
  title: string;
  body?: string | null;
  linkPath?: string | null;
  workspaceId?: string | null;
  treeId?: string | null;
  /** also email the person (order updates); everything else stays in the app */
  email?: boolean;
};

/** In-app notification for one user, plus a device push if they've enabled it. */
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
  await sendPushToUser(userId, {
    title: n.title,
    body: n.body,
    url: n.linkPath,
    kind: String(n.kind),
  });
  if (n.email) await emailUser(userId, n);
}

/** The same message by email, with a link back into the app. */
async function emailUser(userId: string, n: NotifyInput): Promise<void> {
  if (!hasEmailProvider) return; // not set up yet: the in-app notification is enough
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!u?.email) return;
    const link = n.linkPath ? `\n\n${(await publicOrigin()).replace(/\/$/, "")}${n.linkPath}` : "";
    await sendEmail({
      to: u.email,
      subject: n.title,
      text: `Hello${u.name ? ` ${u.name.split(" ")[0]}` : ""},\n\n${n.title}${n.body ? `\n${n.body}` : ""}${link}\n\nFamily Compass`,
    });
  } catch (err) {
    console.error("[notify] email failed", err);
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
  await Promise.all(
    ids.map((userId) =>
      sendPushToUser(userId, {
        title: n.title,
        body: n.body,
        url: n.linkPath,
        kind: String(n.kind),
      }),
    ),
  );
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
