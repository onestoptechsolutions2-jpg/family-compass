import { db } from "@/lib/db";

export async function getWorkspaceCollab(workspaceId: string, selfUserId: string) {
  const [memberships, invites] = await Promise.all([
    db.membership.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    db.invitation.findMany({
      where: { workspaceId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        invitedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      isSelf: m.user.id === selfUserId,
      joined: m.createdAt,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt,
      invitedBy: i.invitedBy.name ?? i.invitedBy.email,
      expired: i.expiresAt.getTime() < Date.now(),
    })),
  };
}

export async function listSharedViews(treeId: string) {
  const rows = await db.sharedView.findMany({
    where: { treeId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      mode: true,
      generations: true,
      includeLiving: true,
      revoked: true,
      expiresAt: true,
      viewCount: true,
      passwordHash: true,
      createdAt: true,
      centralPerson: {
        select: {
          id: true,
          names: {
            select: {
              first: true,
              surname: true,
              surnamePrefix: true,
              suffix: true,
              nick: true,
              title: true,
              preferred: true,
              type: true,
              order: true,
            },
          },
        },
      },
    },
  });
  return rows;
}
