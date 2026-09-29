import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
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
          className="flex flex-wrap items-end gap-3 rounded-xl border p-4 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
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
        </form>
      ))}
    </div>
  );
}
