import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { renderPrintSheet } from "@/lib/print-sheet";
import { depositFor, lines, unitPrice, type DraftOptions, type ProductOptions } from "@/lib/orders";
import { saveStep } from "./actions";

export const metadata = { title: "Design your order" };
export const dynamic = "force-dynamic";

const STEPS = ["Who it is for", "Who to show", "Material and size", "Delivery", "Review"];
const field = "mt-1 w-full rounded-lg border px-4 py-2.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;
const btn = "rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700";

export default async function OrderWizard({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { token } = await params;
  const { step: rawStep } = await searchParams;
  const order = await db.order.findUnique({
    where: { guestToken: token },
    include: { items: { include: { product: true }, take: 1 } },
  });
  const item = order?.items[0];
  if (!order || !item) notFound();

  const me = await getSessionUser();
  if (order.userId && order.userId !== me?.id) notFound();
  if (order.status !== OrderStatus.DRAFT) {
    const dep = await db.payment.findFirst({
      where: { orderId: order.id, kind: "ORDER_DEPOSIT" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    redirect(dep ? `/pay/${dep.id}` : "/app");
  }

  const step = Math.min(Math.max(Number(rawStep) || 1, 1), STEPS.length);
  const o = (item.options ?? {}) as DraftOptions;
  const po = (item.product.options ?? null) as ProductOptions | null;
  const price = unitPrice(item.product.basePriceKes, po, o);
  const save = saveStep.bind(null, token, step);

  // The customer sees exactly what will be made, updated as they build it.
  const previewOptions: DraftOptions = {
    ...o,
    materialKey: o.materialKey ?? (po?.materials?.[0]?.key),
    sizeKey: o.sizeKey ?? (po?.sizes?.[0]?.key),
  };
  const sheet = await renderPrintSheet(
    {
      options: previewOptions,
      productName: item.product.name,
      qrUrl: `${await publicOrigin()}/q/yourcode`,
      pathway: item.product.pathway,
    },
    previewOptions.sizeKey,
  );
  const previewSvg = sheet.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%"');
  const preview = step >= 2 && (
    <div className="mt-6">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Preview of your {item.product.name.toLowerCase()}
      </p>
      <div
        className="mt-2 overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)" }}
        dangerouslySetInnerHTML={{ __html: previewSvg }}
      />
      {sheet.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs" style={{ color: "var(--danger, #b45309)" }}>
          {sheet.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );
  const living = item.product.pathway === "LIVING";
  const label = (t: string) => <span className="text-sm font-medium">{t}</span>;

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-8">
      <Link href={`/shop/${item.product.slug}`} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← {item.product.name}
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Step {step} of {STEPS.length} · {STEPS[step - 1]}
      </p>
      <div className="mt-2 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>

      {step === 1 && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">{living ? "Whose family is this?" : "Who is this for?"}</h1>
          <label>{label(living ? "Your first name(s)" : "First name(s)")}
            <input name="first" required defaultValue={o.first} className={field} style={fieldStyle} />
          </label>
          <label>{label(living ? "Your surname" : "Surname")}
            <input name="surname" defaultValue={o.surname} className={field} style={fieldStyle} />
          </label>
          <label>{label(living ? "Your birth year (optional)" : "Born (date or year)")}
            <input name="birth" defaultValue={o.birth} placeholder="e.g. 12 March 1948" className={field} style={fieldStyle} />
          </label>
          {!living && (
            <>
              <label>{label("Died (date or year)")}
                <input name="death" defaultValue={o.death} placeholder="e.g. 2026" className={field} style={fieldStyle} />
              </label>
              <label>{label("Place of passing or burial (optional)")}
                <input name="place" defaultValue={o.place} className={field} style={fieldStyle} />
              </label>
            </>
          )}
          <label>{label(living ? "A title for your tree (optional)" : "A short line to carry on it (optional)")}
            <input name="epitaph" defaultValue={o.epitaph} maxLength={300} className={field} style={fieldStyle} />
          </label>
          <button className={btn}>Continue</button>
        </form>
      )}

      {step === 2 && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">Who should we show?</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>One name per line. Skip anything you do not know; you can add more later.</p>
          {(["parents", "fatherParents", "motherParents", "spouse", "children", "siblings"] as const).map((k) => (
            <label key={k}>{label({
              parents: "Parents (father first, then mother)",
              fatherParents: "Father's parents",
              motherParents: "Mother's parents",
              spouse: "Spouse",
              children: "Children",
              siblings: "Brothers and sisters",
            }[k])}
              <textarea name={k} rows={3} defaultValue={o[k]} className={field} style={fieldStyle} />
            </label>
          ))}
          <div className="flex gap-3">
            <Link href={`/order/${token}?step=1`} className="rounded-md border px-5 py-2.5 text-sm" style={{ borderColor: "var(--border)" }}>Back</Link>
            <button className={btn}>Continue</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">Choose material and size</h1>
          {(["materials", "sizes"] as const).map((group) => {
            const key = group === "materials" ? "materialKey" : "sizeKey";
            const list = po?.[group] ?? [];
            if (!list.length) return null;
            return (
              <fieldset key={group} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                <legend className="px-1 text-sm font-medium">{group === "materials" ? "Material" : "Size"}</legend>
                {list.map((c, i) => (
                  <label key={c.key} className="mt-2 flex items-center gap-2 text-sm">
                    <input type="radio" name={key} value={c.key} defaultChecked={o[key] === c.key || (!o[key] && i === 0)} />
                    {c.label}{c.addKes ? ` (+${kes(c.addKes)})` : ""}
                  </label>
                ))}
              </fieldset>
            );
          })}
          <p className="text-sm font-medium">Price: {kes(price)}</p>
          <div className="flex gap-3">
            <Link href={`/order/${token}?step=2`} className="rounded-md border px-5 py-2.5 text-sm" style={{ borderColor: "var(--border)" }}>Back</Link>
            <button className={btn}>Continue</button>
          </div>
        </form>
      )}

      {step === 4 && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">Delivery and your details</h1>
          <label>{label("Your name")}
            <input name="contactName" required defaultValue={order.contactName ?? ""} className={field} style={fieldStyle} />
          </label>
          <label>{label("Your phone (WhatsApp if possible)")}
            <input name="contactPhone" required defaultValue={order.contactPhone ?? ""} className={field} style={fieldStyle} />
          </label>
          <label>{label(living ? "Delivery address" : "Delivery address, or the grave and cemetery")}
            <textarea name="deliveryText" rows={3} required defaultValue={order.deliveryText ?? ""} className={field} style={fieldStyle} />
          </label>
          {living ? (
            <input type="hidden" name="relation" value="other" />
          ) : (
            <label>{label("You are their")}
              <select name="relation" defaultValue={o.relation ?? "other"} className={field} style={fieldStyle}>
                <option value="child">Son or daughter</option>
                <option value="spouse">Husband or wife</option>
                <option value="sibling">Brother or sister</option>
                <option value="other">Other relative or friend</option>
              </select>
            </label>
          )}
          <div className="flex gap-3">
            <Link href={`/order/${token}?step=3`} className="rounded-md border px-5 py-2.5 text-sm" style={{ borderColor: "var(--border)" }}>Back</Link>
            <button className={btn}>Review</button>
          </div>
        </form>
      )}

      {preview}

      {step === 5 && (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">Review and approve</h1>
          <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <p className="text-lg font-semibold">{[o.first, o.surname].filter(Boolean).join(" ") || "Name missing"}</p>
            <p style={{ color: "var(--muted)" }}>{[o.birth, o.death].filter(Boolean).join(" – ") || (living ? "" : "Dates not given")}</p>
            {o.epitaph && <p className="mt-2 italic">&ldquo;{o.epitaph}&rdquo;</p>}
            <ul className="mt-3 list-disc pl-5" style={{ color: "var(--muted)" }}>
              {(["parents", "fatherParents", "motherParents", "spouse", "children", "siblings"] as const).map((k) =>
                lines(o[k]).length ? <li key={k}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}: {lines(o[k]).join(", ")}</li> : null,
              )}
            </ul>
            <p className="mt-3">{item.product.name}</p>
            <p className="mt-1 font-medium">Total {kes(price)} · deposit now {kes(depositFor(price))}</p>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {living
              ? "Approving locks this layout for printing and creates the QR code on it. Anyone who scans the QR code can see the people on this tree, with birth years only, and relatives can ask to join it. Next you sign in (or create an account) and pay the deposit."
              : "Approving locks this layout for printing, publishes their memorial page and creates the QR code on it. Next you sign in (or create an account) and pay the deposit."}
          </p>
          {!o.first ? (
            <Link href={`/order/${token}?step=1`} className={btn}>Add their name first</Link>
          ) : (
            <Link href={`/order/${token}/finish`} className={`${btn} text-center`}>
              Approve and continue
            </Link>
          )}
          <Link href={`/order/${token}?step=4`} className="text-center text-sm underline">Back</Link>
        </section>
      )}
    </main>
  );
}
