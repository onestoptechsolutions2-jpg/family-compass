import type { NextRequest } from "next/server";

import { authenticateApi } from "@/lib/api/auth";
import { apiOk, apiPreflight, isResponse } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiPreflight();
}

export async function GET(req: NextRequest) {
  const ctx = await authenticateApi(req, "read");
  if (isResponse(ctx)) return ctx;
  return apiOk({
    ok: true,
    workspace: { id: ctx.workspace.id, name: ctx.workspace.name, slug: ctx.workspace.slug },
    scopes: ctx.scopes,
  });
}
