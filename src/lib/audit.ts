import { db } from "@/lib/db";

/**
 * Platform-level audit trail (distinct from the per-tree ActivityEvent feed).
 * Records privileged / system actions: payment verification, settings
 * changes, backups, DB maintenance, admin alerts. Never throws.
 */
export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  workspaceId?: string | null;
  treeId?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action.slice(0, 120),
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        meta: (input.meta ?? undefined) as never,
        ip: input.ip ?? null,
        workspaceId: input.workspaceId ?? null,
        treeId: input.treeId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write", err);
  }
}

export async function listAudit(limit = 100) {
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      meta: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
}

/** When did action X last happen (for alert de-duplication)? */
export async function lastAuditAt(action: string): Promise<Date | null> {
  const row = await db.auditLog.findFirst({
    where: { action },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
