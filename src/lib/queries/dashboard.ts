import { db } from "@/lib/db";

export async function getUserWorkspaces(userId: string) {
  return db.workspace.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      memberships: {
        where: { userId },
        select: { role: true },
      },
      trees: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          updatedAt: true,
          _count: { select: { people: true, families: true } },
        },
      },
    },
  });
}

export type DashboardWorkspace = Awaited<ReturnType<typeof getUserWorkspaces>>[number];
