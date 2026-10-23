import { NextResponse } from "next/server";

import { getPartnerContext } from "@/lib/partner-auth";
import { jobForPartner } from "@/lib/jobs";
import { renderItemSheet } from "@/lib/print-order";
import { sheetResponse } from "@/lib/print-file";

/** The print sheet for a job the partner may see. Real millimetres; ?format=png for a picture, ?format=pdf to print. */
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { partner } = await getPartnerContext();
  if (!partner || partner.status !== "ACTIVE") return new NextResponse("Not found", { status: 404 });

  const { jobId } = await params;
  const job = await jobForPartner(partner.id, jobId);
  if (!job) return new NextResponse("Not found", { status: 404 });
  const r = await renderItemSheet(job.orderItemId);
  if (!r) return new NextResponse("Not ready", { status: 409 });

  const headers = { "Cache-Control": "private, no-store" };
  return sheetResponse(r.sheet, new URL(req.url).searchParams.get("format"), headers, `job-${jobId}`);
}
