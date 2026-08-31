import { spawn } from "node:child_process";
import { Readable } from "node:stream";

import { getSessionUser } from "@/lib/rbac";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Streams a `pg_dump` of the database (custom format) as a download.
 * Platform admins only. Returns 501 when `pg_dump` isn't on PATH in this
 * container — in that case run it from a machine that has the Postgres client
 * tools (the page shows the command).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.isPlatformAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const child = spawn(
    "pg_dump",
    ["--no-owner", "--no-privileges", "--format=custom", env.DATABASE_URL],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const failed = await new Promise<false | string>((resolve) => {
    child.once("spawn", () => resolve(false));
    child.once("error", (e) => resolve((e as NodeJS.ErrnoException).code ?? e.message));
  });
  if (failed) {
    return Response.json(
      {
        error:
          failed === "ENOENT"
            ? "pg_dump is not installed in this container. Run it from a host with the Postgres client tools."
            : `pg_dump failed to start: ${failed}`,
      },
      { status: 501 },
    );
  }

  let stderr = "";
  child.stderr.on("data", (d) => {
    stderr += String(d);
  });
  child.once("close", (code) => {
    void writeAudit({
      actorId: user.id,
      action: "system.backup.download",
      targetType: "system",
      meta: { exitCode: code, error: code ? stderr.slice(0, 500) : null },
    });
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "").slice(0, 13);
  return new Response(Readable.toWeb(child.stdout) as unknown as ReadableStream, {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="familycompass-${stamp}.dump"`,
      "cache-control": "no-store",
    },
  });
}
