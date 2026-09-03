import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/rbac";
import { restoreFromFile, restoreFromUpload, backupPath } from "@/lib/backup";
import { flashOk, flashErr } from "@/lib/flash";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REDIRECT = "/admin/system?tab=backup";

/**
 * Restore the database from either an uploaded .dump file or one already
 * sitting in BACKUP_DIR. A plain <form encType="multipart/form-data"> POSTs
 * here directly — not a Server Action — because a database dump (media is
 * stored in Postgres, so a real dump can be large) would otherwise be capped
 * by next.config.ts's serverActions.bodySizeLimit.
 *
 * Platform admins only, and requires the literal confirmation text "RESTORE"
 * — this drops and recreates the whole schema (pg_restore --clean). An
 * automatic pre-restore safety backup is taken first regardless (see
 * restoreFromFile) so a wrong file still has an undo path.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user?.isPlatformAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const confirm = String(form.get("confirm") ?? "");
  if (confirm !== "RESTORE") {
    await flashErr('Type "RESTORE" exactly to confirm — nothing was touched.');
    return NextResponse.redirect(new URL(REDIRECT, req.url), 303);
  }

  const file = form.get("file");
  const sourceName = String(form.get("sourceName") ?? "").trim();

  let result;
  try {
    if (file instanceof File && file.size > 0) {
      result = await restoreFromUpload(file, user.id);
    } else if (sourceName) {
      result = await restoreFromFile(backupPath(sourceName), user.id);
    } else {
      await flashErr("Choose a file to upload, or pick a stored backup to restore from.");
      return NextResponse.redirect(new URL(REDIRECT, req.url), 303);
    }
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Restore failed.");
    return NextResponse.redirect(new URL(REDIRECT, req.url), 303);
  }

  if (result.ok) {
    await flashOk(
      "Restore complete. A pre-restore safety backup was saved as " +
        `${result.safetyBackupName} in case anything looks wrong. Restart the app process now — ` +
        "existing database connections may still reflect the old schema until it restarts.",
    );
  } else {
    await flashErr(`Restore failed: ${result.error?.slice(0, 400) ?? "unknown error"}`);
  }
  return NextResponse.redirect(new URL(REDIRECT, req.url), 303);
}
