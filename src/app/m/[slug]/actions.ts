"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "@/lib/db";

export async function postGuestbook(slug: string, formData: FormData) {
  const m = await db.memorial.findUnique({
    where: { slug },
    select: { id: true, published: true, guestbookOpen: true, guestbookModerated: true },
  });
  if (!m || !m.published || !m.guestbookOpen) redirect(`/m/${slug}`);

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const relation = String(formData.get("relation") ?? "").trim().slice(0, 80) || null;
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30) || null;
  if (name.length < 2 || message.length < 3) redirect(`/m/${slug}?err=1`);

  const h = await headers();
  await db.guestbookEntry.create({
    data: {
      memorialId: m.id,
      name,
      relation,
      message,
      phone,
      status: m.guestbookModerated ? "PENDING" : "APPROVED",
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });
  revalidatePath(`/m/${slug}`);
  redirect(`/m/${slug}?posted=${m.guestbookModerated ? "review" : "1"}#guestbook`);
}
