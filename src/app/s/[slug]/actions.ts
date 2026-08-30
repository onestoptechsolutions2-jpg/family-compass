"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { verifySharePassword, shareCookieToken } from "@/lib/share";

export async function submitSharePassword(slug: string, formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  const share = await db.sharedView.findUnique({
    where: { slug },
    select: { passwordHash: true, revoked: true },
  });
  if (!share?.passwordHash || share.revoked) redirect(`/s/${slug}`);
  if (!verifySharePassword(pw, share.passwordHash)) {
    redirect(`/s/${slug}?bad=1`);
  }
  const jar = await cookies();
  jar.set(`fc_share_${slug}`, shareCookieToken(share.passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    path: `/s/${slug}`,
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(`/s/${slug}`);
}
