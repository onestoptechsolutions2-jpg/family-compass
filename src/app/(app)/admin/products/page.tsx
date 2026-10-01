import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import { updateProduct } from "./actions";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const field = "rounded-lg border px-3 py-1.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;

export default async function AdminProductsPage() {
  await requirePlatformAdmin();
  const products = await db.product.findMany({ orderBy: [{ pathway: "asc" }, { sortOrder: "asc" }] });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Products</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Launch prices are placeholders. Set them from supplier quotes before you sell. Hidden products
        disappear from the shop but keep their existing orders.
      </p>
      {products.map((p) => (
        <form
          key={p.id}
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
                if (!list.length) return null;
                return (
                  <div key={g.key}>
                    <p className="text-xs font-medium">{g.title} (adds, KES)</p>
                    {list.map((c) => (
                      <label key={c.key} className="mt-1 flex items-center justify-between gap-2">
                        <span style={{ color: "var(--muted)" }}>{c.label}</span>
                        <input name={`add:${g.list}:${c.key}`} type="number" min={0} defaultValue={c.addKes} className={`${field} w-24`} style={fieldStyle} />
                      </label>
                    ))}
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
      ))}
    </div>
  );
}
