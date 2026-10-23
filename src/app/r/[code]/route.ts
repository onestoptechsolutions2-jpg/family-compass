import { NextResponse } from "next/server";

import { publicOrigin } from "@/lib/origin";
import { REF_COOKIE, REF_COOKIE_DAYS, referrerByCode } from "@/lib/referrals";
import { safeNext } from "@/app/join/safe-next";

/**
 * A referrer's link, /r/<code>: remember who sent this visitor, then show them the shop (or the
 * page named in ?to=). An unknown or suspended code still lands them in the shop, credited to nobody.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = await publicOrigin();
  const to = new URL(req.url).searchParams.get("to");
  const res = NextResponse.redirect(`${origin}${to ? safeNext(to) : "/"}`);
  const r = await referrerByCode(code);
  if (r && r.status === "ACTIVE") {
    res.cookies.set(REF_COOKIE, r.code, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/",
      maxAge: REF_COOKIE_DAYS * 24 * 3600,
    });
  }
  return res;
}
