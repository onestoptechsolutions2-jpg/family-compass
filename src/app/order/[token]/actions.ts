"use server";

import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import type { DraftOptions } from "@/lib/orders";
import { saveDraftPhoto } from "@/lib/draft-photo";
import { parseDestination } from "@/lib/fund-destination";
import { VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import { serviceWhenText } from "@/lib/order-shared";

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
  "serviceDate",
  "serviceTime",
  "insideLater",
  "venue",
  "service",
  "bio",
  "hymns",
  "tribute",
  "thanks",
  "contacts",
  "fundKind",
  "fundNumber",
  "fundAccount",
  "fundName",
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
  // The service day is picked from a calendar; the line printed on the programme is made from it.
  if (formData.has("serviceDate")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next.serviceDate ?? "")) delete next.serviceDate;
    const when = serviceWhenText(next.serviceDate, next.serviceTime);
    if (when) next.serviceWhen = when;
  }
  if (next.insideLater && next.insideLater !== "whatsapp") delete next.insideLater;
  // Where funeral contributions go must be a real M-Pesa destination, or nothing.
  if (formData.has("fundKind")) {
    const dest = parseDestination({ payKind: next.fundKind, payNumber: next.fundNumber, payAccount: next.fundAccount, payName: next.fundName });
    if (next.fundKind && !dest.ok) {
      await db.orderItem.update({ where: { id: item.id }, data: { options: next as DraftOptions } });
      redirect(`/order/${token}?step=${step}&error=${encodeURIComponent(dest.error)}`);
    }
    if (!next.fundKind) for (const k of ["fundNumber", "fundAccount", "fundName"]) delete next[k];
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
