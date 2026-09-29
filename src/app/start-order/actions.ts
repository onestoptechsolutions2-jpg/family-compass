"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { randomToken } from "@/lib/slug";
import { hitLimit } from "@/lib/api/rate-limit";
import type { DraftOptions, } from "@/lib/order-shared";
import type { ProductOptions } from "@/lib/orders";

/** The product each door opens with; the customer can change material later. */
const DOOR_PRODUCT = { living: "wooden-family-tree", remembered: "tombstone-family-tree" } as const;
const FALLBACK_PRODUCT = { living: "family-tree-poster", remembered: "tile-plaque-qr" } as const;

const field = (fd: FormData, k: string, max: number) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

/**
 * The landing page is step 1. Whatever the visitor has typed there becomes a
 * guest draft, and the wizard picks up from the next question.
 */
export async function startFromLanding(formData: FormData) {
  const mode = field(formData, "mode", 20) === "remembered" ? "remembered" : "living";
  const first = field(formData, "first", 120);
  if (!first) redirect("/");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!hitLimit(`order-new:${ip}`, 10, 3600)) redirect("/?error=slow");

  const product =
    (await db.product.findFirst({ where: { slug: DOOR_PRODUCT[mode], active: true } })) ??
    (await db.product.findFirst({ where: { slug: FALLBACK_PRODUCT[mode], active: true } }));
  if (!product) redirect(mode === "remembered" ? "/remembered" : "/living");

  const po = (product.options ?? null) as ProductOptions | null;
  const options: DraftOptions = {
    first,
    surname: field(formData, "surname", 120),
    birth: field(formData, "birth", 60),
    death: mode === "remembered" ? field(formData, "death", 60) : "",
    parents: field(formData, "parents", 600),
    children: field(formData, "children", 600),
    materialKey: po?.materials?.[0]?.key,
    sizeKey: po?.sizes?.[0]?.key,
  };

  const token = randomToken(24);
  await db.order.create({
    data: {
      guestToken: token,
      items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: options as object } },
    },
  });
  // Name, dates, parents and children are already answered: start at "who else".
  redirect(`/order/${token}?step=2`);
}
