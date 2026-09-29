import { NextResponse } from "next/server";
import sharp from "sharp";

import { getPartnerContext } from "@/lib/partner-auth";
import { jobForPartner } from "@/lib/jobs";
import { renderItemSheet } from "@/lib/print-order";

/** The print sheet for a job the partner may see. Real millimetres; ?format=png for a picture. */
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { partner } = await getPartnerContext();
  if (!partner || partner.status !== "ACTIVE") return new NextResponse("Not found", { status: 404 });

  const { jobId } = await params;
  const job = await jobForPartner(partner.id, jobId);
  if (!job) return new NextResponse("Not found", { status: 404 });
  const r = await renderItemSheet(job.orderItemId);
  if (!r) return new NextResponse("Not ready", { status: 409 });

  const headers = { "Cache-Control": "private, no-store" };
  if (new URL(req.url).searchParams.get("format") === "png") {
    const png = await sharp(Buffer.from(r.sheet.svg)).resize({ width: 2400 }).png().toBuffer();
    return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  return new NextResponse(r.sheet.svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
