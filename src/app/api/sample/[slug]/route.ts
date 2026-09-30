import { NextResponse } from "next/server";
import sharp from "sharp";

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { sampleSvg } from "@/lib/sample-sheets";

/** A small picture of what a product looks like, drawn once and kept. */
const pictures = new Map<string, Buffer>();

const QR_EXAMPLE = { slug: "landing-qr", layout: "tree", pathway: "REMEMBERED" as const, options: { materials: [{ key: "granite" }], sizes: [{ key: "square" }] } };

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = await publicOrigin();

  let product: { slug: string; layout: string; pathway: "LIVING" | "REMEMBERED"; options: unknown };
  let version = "";
  if (slug === QR_EXAMPLE.slug) {
    product = QR_EXAMPLE;
  } else {
    // only what is on sale is shown
    const p = await db.product.findFirst({ where: { slug, active: true } });
    if (!p) return new NextResponse("Not found", { status: 404 });
    product = p;
    version = String(p.updatedAt.getTime());
  }

  const key = `${slug}:${version}:${origin}`;
  let png = pictures.get(key);
  if (!png) {
    const svg = await sampleSvg(product, origin, version);
    png = await sharp(Buffer.from(svg), { density: 110 })
      .flatten({ background: "#f4f1ea" }) // a T-shirt design has no background of its own
      .resize({ width: 720, withoutEnlargement: false })
      .webp({ quality: 78 })
      .toBuffer();
    pictures.set(key, png);
  }
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
