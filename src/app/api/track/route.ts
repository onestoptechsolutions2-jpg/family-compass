import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  isViewKind,
  regionFromTimezone,
  countryFromHeaders,
  deviceKind,
  dailyIpHash,
  referrerHost,
} from "@/lib/view-tracking";
import { clientIp } from "@/lib/user-agent";

export const dynamic = "force-dynamic";

/**
 * Public view beacon. Called once per page-load from shared / memorial /
 * contribution / claim pages. Writes one privacy-light ViewEvent, deduped per
 * browser per target for a few hours via a first-party cookie.
 */
export async function POST(req: Request) {
  let body: { kind?: string; target?: string; tz?: string; lang?: string; ref?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  const target = String(body.target ?? "").slice(0, 200);
  if (!isViewKind(kind) || !target) return NextResponse.json({ ok: false }, { status: 400 });

  const cookieName = `fc_v_${kind}_${target}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60);
  if (req.headers.get("cookie")?.includes(`${cookieName}=1`)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // resolve the tree so tree-level analytics can roll up
  let treeId: string | null = null;
  try {
    if (kind === "memorial") {
      treeId = (await db.memorial.findUnique({ where: { slug: target }, select: { treeId: true } }))?.treeId ?? null;
    } else if (kind === "share") {
      treeId = (await db.sharedView.findUnique({ where: { slug: target }, select: { treeId: true } }))?.treeId ?? null;
    } else if (kind === "give") {
      treeId =
        (await db.chamaFund.findUnique({ where: { publicToken: target }, select: { chama: { select: { treeId: true } } } }))?.chama
          .treeId ?? null;
    } else if (kind === "claim") {
      treeId = (await db.claimInvite.findUnique({ where: { token: target }, select: { treeId: true } }))?.treeId ?? null;
    }
  } catch {
    /* best effort */
  }

  const h = req.headers;
  const ua = h.get("user-agent");
  const dev = deviceKind(ua);
  const tz = typeof body.tz === "string" ? body.tz.slice(0, 60) : null;

  // don't record bots at all
  if (dev !== "bot") {
    await db.viewEvent
      .create({
        data: {
          kind,
          targetId: target,
          treeId,
          country: countryFromHeaders(h),
          timezone: tz,
          region: regionFromTimezone(tz),
          lang: typeof body.lang === "string" ? body.lang.slice(0, 20) : null,
          referrerHost: referrerHost(typeof body.ref === "string" ? body.ref : null),
          deviceKind: dev,
          ipHash: dailyIpHash(clientIp(h.get("x-forwarded-for")) ?? h.get("x-real-ip")),
        },
      })
      .catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, "1", { maxAge: 6 * 3600, httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
