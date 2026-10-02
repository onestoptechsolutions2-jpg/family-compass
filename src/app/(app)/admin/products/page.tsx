import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import { LAYOUT_LABEL } from "@/lib/layouts";
import { photoUrl, MAX_PHOTOS_PER_PRODUCT } from "@/lib/product-photos";
import { deletePhoto, makeMainPhoto, updateProduct, uploadPhoto, createProductDraft } from "./actions";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const field = "rounded-lg border px-3 py-1.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;

function photoVariantLabel(options: ProductOptions | null, key: string | null, value: string | null) {
  if (!key || !value) return "All variants";
  const group = VARIANT_GROUPS.find((item) => item.key === key);
  const choice = group && options?.[group.list]?.find((item) => item.key === value);
  return `${group?.title ?? key}: ${choice?.label ?? value}`;
}

export default async function AdminProductsPage() {
  await requirePlatformAdmin();
  const products = await db.product.findMany({
    orderBy: [{ pathway: "asc" }, { sortOrder: "asc" }],
    include: { images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, alt: true, variantKey: true, variantValue: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Products</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Launch prices are placeholders. Set them from supplier quotes before you sell. Hidden products
        disappear from the shop but keep their existing orders.
      </p>
      <details className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <summary className="cursor-pointer font-medium">Create product draft</summary>
        <form action={createProductDraft} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs">Product name
            <input name="name" required minLength={3} maxLength={100} className={`${field} mt-1 block w-full`} style={fieldStyle} placeholder="New baby family tree print" />
          </label>
          <label className="text-xs">URL slug (optional)
            <input name="slug" maxLength={48} className={`${field} mt-1 block w-full`} style={fieldStyle} placeholder="Generated from name" />
          </label>
          <label className="text-xs">Customer group
            <input name="group" required maxLength={60} className={`${field} mt-1 block w-full`} style={fieldStyle} placeholder="Celebrate" />
          </label>
          <label className="text-xs">Pathway
            <select name="pathway" required className={`${field} mt-1 block w-full`} style={fieldStyle}>
              <option value="LIVING">Living family</option>
              <option value="REMEMBERED">Remember someone</option>
            </select>
          </label>
          <label className="text-xs">Layout
            <select name="layout" required className={`${field} mt-1 block w-full`} style={fieldStyle}>
              {Object.entries(LAYOUT_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs">Shop aisle
            <select name="aisle" required className={`${field} mt-1 block w-full`} style={fieldStyle}>
              <option value="wall_art">Wall art</option>
              <option value="memorial_stone">Memorial and stone</option>
              <option value="books_print">Books and print</option>
              <option value="events_merch">Events and merchandise</option>
            </select>
          </label>
          <label className="text-xs">Maker skills (comma-separated)
            <input name="skills" className={`${field} mt-1 block w-full`} style={fieldStyle} placeholder="printing, framing" />
          </label>
          <label className="text-xs">Delivery route
            <select name="shipVia" className={`${field} mt-1 block w-full`} style={fieldStyle}>
              <option value="direct">Maker ships to customer</option>
              <option value="via_us">Route through us for checking</option>
            </select>
          </label>
          <label className="text-xs sm:col-span-2 lg:col-span-3">Description
            <textarea name="summary" required maxLength={300} rows={2} className={`${field} mt-1 block w-full`} style={fieldStyle} placeholder="What the customer receives and how the family data is used" />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Create off-sale draft</button>
            <span className="text-xs" style={{ color: "var(--muted)" }}>No price is guessed; set a supplier quote before enabling sales.</span>
          </div>
        </form>
      </details>
      {products.map((p) => (
        <div key={p.id} className="flex flex-col gap-2">
        <form
          action={updateProduct.bind(null, p.id)}
          className="flex flex-col gap-3 rounded-xl border p-4 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <div className="font-medium">{p.name}</div>
            <div className="font-mono text-xs" style={{ color: "var(--muted)" }}>{p.slug} · {p.pathway.toLowerCase()}</div>
          </div>
          <label>
            <span style={{ color: "var(--muted)" }}>Price (KES)</span>
            <input name="basePriceKes" type="number" min={0} required defaultValue={p.basePriceKes} className={`${field} mt-1 block w-32`} style={fieldStyle} />
          </label>
          <label className="min-w-64 flex-1">
            <span style={{ color: "var(--muted)" }}>Description</span>
            <input name="summary" defaultValue={p.summary} maxLength={300} className={`${field} mt-1 block w-full`} style={fieldStyle} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={p.active} /> On sale
          </label>
          <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">Save</button>
          </div>
          <details>
            <summary className="cursor-pointer text-xs" style={{ color: "var(--muted)" }}>Prices of materials, colours, sizes and generations</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VARIANT_GROUPS.map((g) => {
                const list = ((p.options ?? {}) as ProductOptions)[g.list] ?? [];
                return (
                  <div key={g.key}>
                    <label className="block text-xs font-medium">
                      {g.title} choices (key|label|price in KES, one per line)
                      <textarea
                        name={`choices:${g.list}`}
                        rows={Math.min(Math.max(list.length, 3), 7)}
                        defaultValue={list.map((choice) => `${choice.key}|${choice.label}|${choice.addKes}`).join("\n")}
                        placeholder={g.key === "finishKey" ? "oak|Light oak|0\nwalnut|Dark walnut|800" : `standard|Standard|0`}
                        className={`${field} mt-1 block w-full font-mono text-xs`}
                        style={fieldStyle}
                        aria-label={`${g.title} variant choices`}
                      />
                    </label>
                  </div>
                );
              })}
              {((p.options ?? {}) as ProductOptions).generations && (
                <div>
                  <p className="text-xs font-medium">Generations</p>
                  <label className="mt-1 flex items-center justify-between gap-2">
                    <span style={{ color: "var(--muted)" }}>Included in the price</span>
                    <input name="gen:included" type="number" min={1} max={4} defaultValue={((p.options ?? {}) as ProductOptions).generations!.included} className={`${field} w-24`} style={fieldStyle} />
                  </label>
                  <label className="mt-1 flex items-center justify-between gap-2">
                    <span style={{ color: "var(--muted)" }}>Each extra adds (KES)</span>
                    <input name="gen:perExtra" type="number" min={0} defaultValue={((p.options ?? {}) as ProductOptions).generations!.perExtraKes} className={`${field} w-24`} style={fieldStyle} />
                  </label>
                </div>
              )}
            </div>
          </details>
        </form>
        <details className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <summary className="cursor-pointer text-xs" style={{ color: "var(--muted)" }}>
            Photos ({p.images.length}){p.images.length === 0 ? ": none yet, the shop shows a drawn example" : ""}
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            {p.images.map((im, i) => (
              <div key={im.id} className="w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(im.id, true)} alt={im.alt || p.name} width={144} height={108} className="aspect-[4/3] w-full rounded-lg border object-cover" style={{ borderColor: "var(--border)" }} loading="lazy" />
                <p className="mt-1 truncate text-xs" style={{ color: "var(--muted)" }}>{i === 0 ? "Main · " : ""}{photoVariantLabel((p.options ?? null) as ProductOptions | null, im.variantKey, im.variantValue)} · {im.alt || "Photo"}</p>
                <div className="mt-1 flex gap-3 text-xs">
                  {i > 0 && <form action={makeMainPhoto.bind(null, im.id)}><button className="underline">Make main</button></form>}
                  <form action={deletePhoto.bind(null, im.id)}><button className="underline" style={{ color: "var(--danger)" }}>Remove</button></form>
                </div>
              </div>
            ))}
          </div>
          {p.images.length < MAX_PHOTOS_PER_PRODUCT && (
            <form action={uploadPhoto.bind(null, p.id)} encType="multipart/form-data" className="mt-3 flex flex-wrap items-end gap-3">
              <label>
                <span className="block text-xs" style={{ color: "var(--muted)" }}>Photo (JPEG, PNG or WebP, up to 8 MB)</span>
                <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1 text-sm" />
              </label>
              <label className="min-w-48 flex-1">
                <span className="block text-xs" style={{ color: "var(--muted)" }}>Describe it (for people who cannot see it)</span>
                <input name="alt" maxLength={200} className={`${field} mt-1 block w-full`} style={fieldStyle} placeholder={`e.g. ${p.name} on a wall`} />
              </label>
              <label>
                <span className="block text-xs" style={{ color: "var(--muted)" }}>Show for</span>
                <select name="variant" className={`${field} mt-1 block max-w-64`} style={fieldStyle} defaultValue="">
                  <option value="">All variants</option>
                  {VARIANT_GROUPS.flatMap((group) =>
                    (((p.options ?? {}) as ProductOptions)[group.list] ?? []).map((choice) => (
                      <option key={`${group.key}=${choice.key}`} value={`${group.key}=${choice.key}`}>
                        {group.title}: {choice.label}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">Upload</button>
            </form>
          )}
        </details>
        </div>
      ))}
    </div>
  );
}
