import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { publicOrigin } from "@/lib/origin";
import { randomToken } from "@/lib/slug";
import { verifyChamaSignature } from "@/lib/chama-signature";
import { normaliseCode, normalisePhone } from "@/lib/referral-rules";

export const dynamic = "force-dynamic";

/**
 * Chama approved a bereavement claim and the family agreed to hear from us. The chama group becomes
 * (or already is) a referrer, so it earns the referral commission on the programme the family
 * orders, paid to the account it nominated. We answer with the link Chama texts to the family.
 * No personal details arrive here: only the group, its code and its payout account.
 */
export async function POST(req: Request) {
  if (!env.CHAMA_REFERRAL_SECRET) return NextResponse.json({ error: "not configured" }, { status: 404 });
  const raw = await req.text();
  if (!verifyChamaSignature(raw, req.headers.get("x-chama-timestamp"), req.headers.get("x-chama-signature-256"), env.CHAMA_REFERRAL_SECRET)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const eventId = typeof body.eventId === "string" ? body.eventId.slice(0, 100) : "";
  const externalRef = typeof body.referrerCode === "string" ? body.referrerCode.slice(0, 40) : "";
  const code = normaliseCode(externalRef);
  if (body.event !== "bereavement.approved" || !eventId || !code) return NextResponse.json({ error: "unexpected payload" }, { status: 400 });

  const name = (typeof body.groupName === "string" && body.groupName.trim().slice(0, 120)) || "Chama group";
  const payout = body.payout && typeof body.payout === "object" ? (body.payout as Prisma.InputJsonObject) : null;
  const phone = payout && payout.kind === "mpesa" && typeof payout.phone === "string" ? normalisePhone(payout.phone) : null;

  // a resend is answered the same way: the referrer already exists, so the same link is right
  await db.partnerEvent.createMany({ data: [{ eventId, source: "chama" }], skipDuplicates: true });
  // the group may have changed its name or its account since it last referred someone
  const known = await db.referrer.findUnique({ where: { externalRef }, select: { code: true } });
  const fields = { name, payoutPhone: phone, payout: payout ?? Prisma.DbNull };
  const referrer = known
    ? await db.referrer.update({ where: { externalRef }, data: fields, select: { code: true } })
    : await db.referrer.create({
        // "CHAMA15", unless a person already chose that code
        data: { externalRef, kind: "chama", code: (await db.referrer.findUnique({ where: { code }, select: { id: true } })) ? `${code.slice(0, 11)}${randomToken(4).toUpperCase()}` : code, ...fields },
        select: { code: true },
      });

  return NextResponse.json({ link: `${await publicOrigin()}/r/${referrer.code}?to=${encodeURIComponent("/shop/funeral-programme")}` });
}
