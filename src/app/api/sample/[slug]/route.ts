import { NextResponse } from "next/server";
import sharp from "sharp";

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { sampleSvg } from "@/lib/sample-sheets";
import { MOCKUP_W, mockupSvg, sceneFor } from "@/lib/mockup";
import type { ProductOptions } from "@/lib/product-pricing";

/** A small picture of what a product looks like, drawn once and kept. */
const pictures = new Map<string, Buffer>();

const QR_EXAMPLE = { slug: "landing-qr", layout: "tree", pathway: "REMEMBERED" as const, options: { materials: [{ key: "granite" }], sizes: [{ key: "square" }] } };

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
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
  const search = new URL(req.url).searchParams;
  const selected = {
    materialKey: search.get("materialKey") ?? undefined,
    finishKey: search.get("finishKey") ?? undefined,
    sizeKey: search.get("sizeKey") ?? undefined,
  };
  const variantKey = `${selected.materialKey ?? ""}:${selected.finishKey ?? ""}:${selected.sizeKey ?? ""}`;
  const cacheKey = `${key}:${variantKey}`;
  let png = pictures.get(cacheKey);
  if (!png) {
    const svg = await sampleSvg(product, origin, version, selected);
    // a product is shown in a simple scene; the flat sheet is only for the landing page's QR example
    const m = /width="([\d.]+)mm" height="([\d.]+)mm"/.exec(svg);
    const po = (product.options ?? null) as ProductOptions | null;
    const materialKey = po?.materials?.some((choice) => choice.key === selected.materialKey) ? selected.materialKey : po?.materials?.[0]?.key;
    const finishKey = po?.finishes?.some((choice) => choice.key === selected.finishKey) ? selected.finishKey : po?.finishes?.[0]?.key;
    const scene = slug !== QR_EXAMPLE.slug && m
      ? mockupSvg({ scene: sceneFor({ slug, layout: product.layout, materialKey }), sheetSvg: svg, sheetW: Number(m[1]), sheetH: Number(m[2]), finishKey })
      : svg;
    png = await sharp(Buffer.from(scene), { density: scene === svg ? 110 : 72 })
      .flatten({ background: "#f4f1ea" }) // a T-shirt design has no background of its own
      .resize({ width: scene === svg ? 720 : Math.min(MOCKUP_W, 900), withoutEnlargement: false })
      .webp({ quality: 78 })
      .toBuffer();
    pictures.set(cacheKey, png);
  }
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
