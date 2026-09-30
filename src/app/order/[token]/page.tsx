import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { renderPrintSheet } from "@/lib/print-sheet";
import { isLayout, isReady, requiredKey, stepsFor, type Field, type Layout } from "@/lib/layouts";
import { amountDueNow, lines, unitPrice, type DraftOptions, type ProductOptions } from "@/lib/orders";
import { saveStep } from "./actions";
import { TreeBuilder } from "@/components/TreeBuilder";

export const metadata = { title: "Design your order" };
export const dynamic = "force-dynamic";

/** A tree is built by tapping it; everything else is a short form. */
const FLOW_FORM = ["about", "details", "material", "review"] as const;
const FLOW_BUILD = ["build", "material", "review"] as const;
const STEP_LABEL = { build: "Build your tree", about: "About it", details: "The details", material: "Material and size", review: "Review" } as const;
const field = "mt-1 w-full rounded-lg border px-4 py-2.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;
const btn = "rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700";
const ghost = "rounded-md border px-5 py-2.5 text-sm";
const ghostStyle = { borderColor: "var(--border)" } as const;

const RELATIONS = [
  ["child", "Son or daughter"],
  ["spouse", "Husband or wife"],
  ["sibling", "Brother or sister"],
  ["other", "Other relative or friend"],
] as const;

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
  if (order?.notes?.startsWith("merged:")) redirect("/cart");
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

  const layout: Layout = isLayout(item.product.layout) ? item.product.layout : "tree";
  const pathway = item.product.pathway;
  const [step1, step2] = stepsFor(layout, pathway);
  const tapTree = layout === "tree" || layout === "banner";
  const flow: readonly (keyof typeof STEP_LABEL)[] = tapTree ? FLOW_BUILD : FLOW_FORM;
  const step = Math.min(Math.max(Number(rawStep) || 1, 1), flow.length);
  const current = flow[step - 1]!;
  const at = (s: keyof typeof STEP_LABEL) => flow.indexOf(s) + 1;
  const before = flow[step - 2] ? at(flow[step - 2]!) : 1;
  const o = (item.options ?? {}) as DraftOptions;
  const po = (item.product.options ?? null) as ProductOptions | null;
  const price = unitPrice(item.product.basePriceKes, po, o);
  const save = saveStep.bind(null, token, step);

  // The customer sees exactly what will be made, updated as they build it.
  const previewOptions: DraftOptions = {
    ...o,
    materialKey: o.materialKey ?? po?.materials?.[0]?.key,
    sizeKey: o.sizeKey ?? po?.sizes?.[0]?.key,
  };
  const sheet = await renderPrintSheet(
    { options: previewOptions, productName: item.product.name, qrUrl: `${await publicOrigin()}/q/yourcode`, pathway, layout },
    previewOptions.sizeKey,
  );
  const previewSvg = sheet.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%"');
  const preview = (current === "details" || current === "material" || current === "review") && (
    <div className="mt-6">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Preview of your {item.product.name.toLowerCase()}
      </p>
      <div className="mt-2 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: layout === "shirt" ? "#e8e8e8" : undefined }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
      {sheet.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs" style={{ color: "var(--danger, #b45309)" }}>
          {sheet.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );

  const label = (t: string) => <span className="text-sm font-medium">{t}</span>;
  const renderField = (f: Field) => {
    if (f.relation) {
      return (
        <label key="relation">{label(f.label || "You are their")}
          <select name="relation" defaultValue={o.relation ?? "other"} className={field} style={fieldStyle}>
            {RELATIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      );
    }
    const value = o[f.key] as string | undefined;
    return (
      <label key={f.key}>
        {label(f.label)}
        {f.hint && <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>{f.hint}</span>}
        {f.rows ? (
          <textarea name={f.key} rows={f.rows} defaultValue={value} placeholder={f.placeholder} className={field} style={fieldStyle} />
        ) : (
          <input name={f.key} defaultValue={value} placeholder={f.placeholder} required={f.key === requiredKey(layout) && step === 1} className={field} style={fieldStyle} />
        )}
      </label>
    );
  };

  // What was entered, in the customer's own words, for the review.
  const filled = [...step1.fields, ...step2.fields].filter((f) => !f.relation && (o[f.key] as string | undefined)?.trim());
  const headline = o.title?.trim() || [o.first, o.surname].filter(Boolean).join(" ") || "Name missing";

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-8">
      <Link href={`/shop/${item.product.slug}`} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← {item.product.name}
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Step {step} of {flow.length} · {STEP_LABEL[current]}
      </p>
      <div className="mt-2 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(step / flow.length) * 100}%` }} />
      </div>

      {current === "build" && (
        <section className="mt-6">
          <h1 className="font-serif text-2xl">{pathway === "LIVING" ? "Build your family tree" : "Build their family tree"}</h1>
          <TreeBuilder
            token={token}
            slug={item.product.slug}
            initial={o}
            pathway={pathway}
            layout={layout}
            origin={await publicOrigin()}
            materialKey={previewOptions.materialKey}
            productName={item.product.name}
          />
        </section>
      )}

      {current === "about" && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">{step1.title}</h1>
          {step1.intro && <p className="text-sm" style={{ color: "var(--muted)" }}>{step1.intro}</p>}
          {step1.fields.map(renderField)}
          <button className={btn}>Continue</button>
        </form>
      )}

      {current === "details" && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">{step2.title}</h1>
          {step2.intro && <p className="text-sm" style={{ color: "var(--muted)" }}>{step2.intro}</p>}
          {step2.fields.map(renderField)}
          <div className="flex gap-3">
            <Link href={`/order/${token}?step=${before}`} className={ghost} style={ghostStyle}>Back</Link>
            <button className={btn}>Continue</button>
          </div>
        </form>
      )}

      {current === "material" && (
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
          <p className="text-sm font-medium">Price: {kes(price)} <span className="font-normal" style={{ color: "var(--muted)" }}>· delivery included</span></p>
          <div className="flex gap-3">
            <Link href={`/order/${token}?step=${before}`} className={ghost} style={ghostStyle}>Back</Link>
            <button className={btn}>Continue</button>
          </div>
        </form>
      )}

      {preview}

      {current === "review" && (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">Review your design</h1>
          <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <p className="text-lg font-semibold">{headline}</p>
            <ul className="mt-3 list-disc pl-5" style={{ color: "var(--muted)" }}>
              {filled.map((f) => {
                const v = (o[f.key] as string).trim();
                const n = lines(v).length;
                return <li key={f.key}>{f.label}: {f.rows ? (n > 4 ? `${n} entries` : lines(v).join(", ")) : v}</li>;
              })}
            </ul>
            <p className="mt-3">{item.product.name}</p>
            <p className="mt-1 font-medium">{kes(amountDueNow(price))} <span className="font-normal" style={{ color: "var(--muted)" }}>· delivery included</span></p>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {pathway === "LIVING"
              ? "When you place your order, this layout is locked for printing and a QR code is created on it. Anyone who scans the QR code can see the people on your family page, with birth years only, and relatives can ask to join it. You can keep shopping and check out when you are ready."
              : "When you place your order, this layout is locked for printing, their memorial page is published and a QR code is created on it. You can keep shopping and check out when you are ready."}
          </p>
          {!isReady(layout, o) ? (
            <Link href={`/order/${token}?step=1`} className={btn}>Complete the first step</Link>
          ) : (
            <Link href={`/order/${token}/add`} className={`${btn} text-center`}>Add to cart</Link>
          )}
          <Link href={`/order/${token}?step=${before}`} className="text-center text-sm underline">Back</Link>
        </section>
      )}
    </main>
  );
}
