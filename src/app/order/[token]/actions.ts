"use server";

import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import type { DraftOptions } from "@/lib/orders";
import { saveDraftPhoto } from "@/lib/draft-photo";
import { VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";

const TEXT_KEYS = [
  "first",
  "surname",
  "birth",
  "death",
  "place",
  "epitaph",
  "parents",
  "fatherParents",
  "motherParents",
  "spouse",
  "children",
  "siblings",
  "spouseParents",
  "title",
  "year",
  "birthdays",
  "attendees",
  "serviceWhen",
  "venue",
  "service",
  "bio",
  "hymns",
  "tribute",
  "thanks",
  "contacts",
  "materialKey",
  "sizeKey",
  "finishKey",
  "pagesKey",
  "copiesKey",
  "relation",
] as const;

/** The life story and the order of service can be long. */
const LONG_KEYS = new Set<string>(["bio", "service", "tribute", "thanks"]);

/** Save whichever fields this step posted, then go to the next step. */
export async function saveStep(token: string, step: number, formData: FormData) {
  const order = await db.order.findUnique({
    where: { guestToken: token },
    include: { items: { take: 1 } },
  });
  const item = order?.items[0];
  if (!order || !item || order.status !== OrderStatus.DRAFT) redirect("/remembered");

  const next: Record<string, string> = { ...((item.options ?? {}) as Record<string, string>) };
  // a variant must be one this product actually offers
  const po = (await db.product.findUnique({ where: { id: item.productId }, select: { options: true } }))?.options as ProductOptions | null;
  const offered = (key: string, v: string) => {
    const g = VARIANT_GROUPS.find((x) => x.key === key);
    return !g || Boolean(po?.[g.list]?.some((c) => c.key === v));
  };
  for (const key of TEXT_KEYS) {
    const v = formData.get(key);
    if (typeof v === "string" && !offered(key, v)) continue;
    if (typeof v === "string") next[key] = v.trim().slice(0, key === "epitaph" ? 300 : LONG_KEYS.has(key) ? 8000 : key === "birthdays" || key === "attendees" ? 4000 : 600);
  }
  // A photo is only ever set by uploading one, never from typed text.
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      next.photoId = await saveDraftPhoto(photo);
    } catch (e) {
      await db.orderItem.update({ where: { id: item.id }, data: { options: next as DraftOptions } });
      redirect(`/order/${token}?step=${step}&error=${encodeURIComponent((e as Error).message)}`);
    }
  } else if (formData.get("removePhoto") === "on") {
    delete next.photoId;
  }
  await db.orderItem.update({ where: { id: item.id }, data: { options: next as DraftOptions } });

  const contactName = formData.get("contactName");
  const contactPhone = formData.get("contactPhone");
  const deliveryText = formData.get("deliveryText");
  if (typeof contactName === "string") {
    await db.order.update({
      where: { id: order.id },
      data: {
        contactName: contactName.trim().slice(0, 120) || null,
        contactPhone: typeof contactPhone === "string" ? contactPhone.trim().slice(0, 40) || null : null,
        deliveryText: typeof deliveryText === "string" ? deliveryText.trim().slice(0, 500) || null : null,
      },
    });
  }
  redirect(`/order/${token}?step=${step + 1}`);
}
