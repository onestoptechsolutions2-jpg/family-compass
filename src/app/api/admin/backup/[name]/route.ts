import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { getSessionUser } from "@/lib/rbac";
import { backupPath } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** Download one previously-created backup file straight from BACKUP_DIR. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getSessionUser();
  if (!user?.isPlatformAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { name } = await params;
  let filePath: string;
  try {
    filePath = backupPath(name);
  } catch {
    return Response.json({ error: "invalid backup name" }, { status: 400 });
  }

  const st = await stat(filePath).catch(() => null);
  if (!st) return Response.json({ error: "not found" }, { status: 404 });

  return new Response(Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(st.size),
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
