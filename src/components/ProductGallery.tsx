"use client";

import Link from "next/link";
import { useState } from "react";

import type { ProductPhoto } from "@/lib/product-photo-selection";
import { photosForVariants } from "@/lib/product-photo-selection";
import { kes } from "@/lib/money";
import { priceBreakdown, VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import type { Layout } from "@/lib/layouts";
import type { DraftOptions } from "@/lib/order-shared";

const SWATCH: Record<string, string> = {
  black: "#252a30",
  grey: "#8c9298",
  light: "#c79661",
  dark: "#624733",
  white: "#ffffff",
  cream: "#f3ead8",
  oak: "#c9a36b",
  navy: "#223d59",
  maroon: "#823e4d",
};

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
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.filter((group) => group.items.length).map((group) => [group.key, group.items[0]!.key])),
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [prioritizeGenerated, setPrioritizeGenerated] = useState(false);
  const selectedOptions: DraftOptions = { ...selected };
  const price = priceBreakdown(basePriceKes, options, layout, selectedOptions);
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
  const galleryPhotos = prioritizeGenerated
    ? [generatedPreview, ...uploadedPhotos]
    : [...uploadedPhotos, generatedPreview];
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
          <p className="mt-4 text-2xl font-semibold tabular-nums" aria-live="polite">
            {kes(price.total)} <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>KES · delivery included</span>
          </p>
        </div>

        {groups.filter((group) => group.items.length).map((group) => (
          <fieldset key={group.key}>
            <legend className="mb-2 text-sm font-semibold">{group.title}</legend>
            <div className="flex flex-wrap gap-2">
              {group.items.map((choice) => {
                const active = selected[group.key] === choice.key;
                return (
                  <button
                    key={choice.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelected((current) => ({ ...current, [group.key]: choice.key }));
                      setPrioritizeGenerated(true);
                      setPhotoIndex(0);
                    }}
                    className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition"
                    style={{
                      borderColor: active ? "var(--primary)" : "var(--border)",
                      background: active ? "color-mix(in srgb, var(--primary) 8%, var(--surface))" : "var(--surface)",
                      boxShadow: active ? "0 0 0 1px var(--primary)" : undefined,
                    }}
                  >
                    {group.key === "finishKey" && SWATCH[choice.key] && (
                      <span className="size-4 shrink-0 rounded-full border" style={{ background: SWATCH[choice.key], borderColor: "var(--border)" }} aria-hidden />
                    )}
                    <span>{choice.label}</span>
                    {choice.addKes > 0 && <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>+{kes(choice.addKes)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {price.adds.length > 0 && (
          <div className="border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            {price.adds.map((line) => <div key={line.label} className="flex justify-between"><span>{line.label}</span><span>+{kes(line.kes)}</span></div>)}
          </div>
        )}
        <Link href={`/order/new?${orderQuery.toString()}`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">
          Personalise and add to cart
        </Link>
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
        <p className="text-xs" style={{ color: "var(--muted)" }}>You can review the family details before anything is ordered or made.</p>
      </div>
    </section>
  );
}