"use client";

import Link from "next/link";
import { useState } from "react";

import type { ProductPhoto } from "@/lib/product-photo-selection";
import { photosForVariants } from "@/lib/product-photo-selection";
import { kes } from "@/lib/money";
import { listPrice, VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import type { Layout } from "@/lib/layouts";


export function ProductGallery({
  slug,
  name,
  description,
  basePriceKes,
  options,
  layout,
  photos,
  savedPeople = [],
  defaultSavedPersonId,
}: {
  slug: string;
  name: string;
  description: string;
  basePriceKes: number;
  options: ProductOptions;
  layout: Layout;
  photos: ProductPhoto[];
  savedPeople?: { id: string; name: string }[];
  defaultSavedPersonId?: string | null;
}) {
  const groups = VARIANT_GROUPS.map((group) => ({ ...group, items: options[group.list] ?? [] }));
  // the shop shows each product as it first comes; choices are made in step 2 of the order
  const selected: Record<string, string> = Object.fromEntries(groups.filter((group) => group.items.length).map((group) => [group.key, group.items[0]!.key]));
  const [photoIndex, setPhotoIndex] = useState(0);
  const range = listPrice(basePriceKes, options, layout);
  const visiblePhotos = photosForVariants(photos, selected);
  const orderQuery = new URLSearchParams({ product: slug });
  const previewQuery = new URLSearchParams();
  for (const group of VARIANT_GROUPS) {
    const value = selected[group.key];
    if (value) {
      orderQuery.set(group.key, value);
      previewQuery.set(group.key, value);
    }
  }
  const generatedPreview: ProductPhoto = {
    src: `/api/sample/${slug}${previewQuery.size ? `?${previewQuery.toString()}` : ""}`,
    alt: `Generated preview of ${name} in the selected variants`,
  };
  const uploadedPhotos = visiblePhotos.filter((photo) => !photo.src.startsWith("/api/sample/"));
  const galleryPhotos = [...uploadedPhotos, generatedPreview];
  const activePhoto = galleryPhotos[photoIndex] ?? galleryPhotos[0];

  return (
    <section className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          {activePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activePhoto.src} alt={activePhoto.alt} className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/3] place-items-center text-sm" style={{ color: "var(--muted)" }}>Product photo coming soon</div>
          )}
        </div>
        {galleryPhotos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product photos">
            {galleryPhotos.map((photo, index) => (
              <button
                key={`${photo.src}-${index}`}
                type="button"
                onClick={() => setPhotoIndex(index)}
                aria-label={`Show photo ${index + 1}: ${photo.alt}`}
                aria-pressed={index === photoIndex}
                className="w-20 shrink-0 overflow-hidden rounded-lg border"
                style={{ borderColor: index === photoIndex ? "var(--primary)" : "var(--border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.src} alt="" className="aspect-[4/3] w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          {activePhoto?.src.startsWith("/api/sample/")
            ? "Illustrative preview. Your piece is made with the choices shown."
                    : "Product photo. A generated preview of your selected variants is also available."}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{name}</h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{description}</p>
          <p className="mt-4 text-2xl font-semibold tabular-nums">
            {range.to > range.from ? "From " : ""}{kes(range.from)} <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>delivery included</span>
          </p>
        </div>

        <Link href={`/order/new?${orderQuery.toString()}`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">
          Start
        </Link>
        <p className="-mt-2 text-center text-xs" style={{ color: "var(--muted)" }}>3 steps: your details, check and choose, pay by M-Pesa.</p>
        {savedPeople.length > 0 && (
          <form action="/order/new" method="get" className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <input type="hidden" name="product" value={slug} />
            {VARIANT_GROUPS.map((group) => selected[group.key] && <input key={group.key} type="hidden" name={group.key} value={selected[group.key]} />)}
            <label className="block text-sm font-medium">
              Make this from saved family data
              <select name="personId" required defaultValue={defaultSavedPersonId ?? savedPeople[0]!.id} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                {savedPeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <button className="mt-3 min-h-10 w-full rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
              Use this family data
            </button>
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>Names, dates and relatives are copied into this design. Your family record stays saved to your account.</p>
          </form>
        )}
      </div>
    </section>
  );
}