import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { hashApiKey, type ApiScope } from "@/lib/api/keys";
import { apiError } from "@/lib/api/respond";
import { checkRateLimit } from "@/lib/api/rate-limit";

export type ApiContext = {
  keyId: string;
  workspaceId: string;
  scopes: string[];
  workspace: { id: string; name: string; slug: string };
};

/**
 * Authenticate an /api/v1 request. Returns an ApiContext on success or a
 * ready-to-return error Response. Also enforces a per-key rate limit.
 */
export async function authenticateApi(
  req: NextRequest,
  need: ApiScope = "read",
): Promise<ApiContext | Response> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return apiError(401, "unauthorized", "Provide 'Authorization: Bearer <api key>'.");
  }
  const key = match[1]!.trim();
  if (!key.startsWith("fc_live_")) {
    return apiError(401, "unauthorized", "Malformed API key.");
  }

  const row = await db.apiKey.findUnique({
    where: { hashedKey: hashApiKey(key) },
    select: {
      id: true,
      scopes: true,
      revokedAt: true,
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!row || row.revokedAt) {
    return apiError(401, "unauthorized", "Unknown or revoked API key.");
  }

  const rl = checkRateLimit(row.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Too many requests. Slow down.", {
      "Retry-After": String(rl.retryAfterSec),
    });
  }

  if (!row.scopes.includes(need)) {
    return apiError(403, "forbidden", `This key is missing the '${need}' scope.`);
  }

  // best-effort last-used stamp
  db.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    keyId: row.id,
    workspaceId: row.workspace.id,
    scopes: row.scopes,
    workspace: row.workspace,
  };
}

/** Assert a tree belongs to the authenticated workspace; returns id or error. */
export async function requireApiTree(ctx: ApiContext, treeId: string): Promise<{ id: string; name: string; slug: string } | Response> {
  const tree = await db.tree.findFirst({
    where: { id: treeId, workspaceId: ctx.workspaceId },
    select: { id: true, name: true, slug: true },
  });
  if (!tree) return apiError(404, "not_found", "Tree not found in this workspace.");
  return tree;
}
