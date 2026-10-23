import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { renderPrintSheet } from "@/lib/print-sheet";
import { isLayout, isReady, requiredKey, stepsFor, type Field, type Layout } from "@/lib/layouts";
import { amountDueNow, lines, type DraftOptions } from "@/lib/orders";
import { firstChoices, priceBreakdown, VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import { previewBackground } from "@/lib/print-kit";
import { draftPhotoUrl } from "@/lib/draft-photo";
import { saveStep } from "./actions";
import { TreeBuilder } from "@/components/TreeBuilder";
import { VariantPicker } from "@/components/VariantPicker";

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
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const { token } = await params;
  const { step: rawStep, error } = await searchParams;
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
  const save = saveStep.bind(null, token, step);

  // The customer sees exactly what will be made, updated as they build it.
  const previewOptions: DraftOptions = {
    ...firstChoices(po),
    ...o,
  };
  const photoHref = o.photoId ? draftPhotoUrl(o.photoId) : undefined;
  const priced = priceBreakdown(item.product.basePriceKes, po, layout, previewOptions);
  const price = priced.total;
  const sheet = await renderPrintSheet(
    { options: previewOptions, productName: item.product.name, qrUrl: `${await publicOrigin()}/q/yourcode`, pathway, layout, photoHref },
    previewOptions.sizeKey,
  );
  const previewSvg = sheet.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%"');
  const preview = (current === "details" || current === "review") && (
    <div className="mt-6">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Preview of your {item.product.name.toLowerCase()}
      </p>
      <div className="mt-2 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: previewBackground(layout, previewOptions.finishKey) }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
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
    if (f.photo) {
      return (
        <div key={f.key}>
          {label(f.label)}
          {f.hint && <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>{f.hint}</span>}
          {photoHref && (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoHref} alt="The photo you added" className="h-20 w-16 rounded-md border object-cover" style={{ borderColor: "var(--border)" }} />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="removePhoto" /> Remove it</label>
            </div>
          )}
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm" />
          {photoHref && <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>Choose another to replace it.</span>}
        </div>
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
  const filled = [...step1.fields, ...step2.fields].filter((f) => !f.relation && !f.photo && (o[f.key] as string | undefined)?.trim());
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

      {error && <p className="mt-4 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}

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
            finishKey={previewOptions.finishKey}
            productName={item.product.name}
            pricing={{ basePriceKes: item.product.basePriceKes, po: po ?? {}, sizeKey: previewOptions.sizeKey }}
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
          <h1 className="font-serif text-2xl">{layout === "programme" ? "Choose pages, paper and copies" : "Choose material and size"}</h1>
          <VariantPicker
            basePriceKes={item.product.basePriceKes}
            po={po ?? {}}
            layout={layout}
            pathway={pathway}
            productName={item.product.name}
            origin={await publicOrigin()}
            options={previewOptions}
            initialSvg={previewSvg}
            photoHref={photoHref}
          />
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
            <p className="mt-3 font-medium">{item.product.name}</p>
            <ul className="mt-1 list-disc pl-5" style={{ color: "var(--muted)" }}>
              {VARIANT_GROUPS.map((g) => {
                const c = po?.[g.list]?.find((x) => x.key === previewOptions[g.key]);
                return c ? <li key={g.key}>{g.title}: {c.label}</li> : null;
              })}
              {priced.generations !== null && <li>{priced.generations} {priced.generations === 1 ? "generation" : "generations"} of family</li>}
            </ul>
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex justify-between"><span>Base price</span><span>{kes(priced.base)}</span></div>
              {priced.adds.map((a) => (
                <div key={a.label} className="flex justify-between" style={{ color: "var(--muted)" }}><span>{a.label}</span><span>+{kes(a.kes)}</span></div>
              ))}
              <div className="mt-2 flex justify-between text-base font-semibold"><span>Total <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>· delivery included</span></span><span>{kes(amountDueNow(price))}</span></div>
            </div>
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
