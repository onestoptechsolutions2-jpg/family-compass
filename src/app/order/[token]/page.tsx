import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { renderPrintSheet } from "@/lib/print-sheet";
import { isLayout, isReady, requiredKey, stepsFor, type Field, type Layout } from "@/lib/layouts";
import { cookies } from "next/headers";
import { findMatchQuestions } from "@/lib/matching";
import { userConsentState } from "@/lib/consent";
import { REF_COOKIE, referrerByCode } from "@/lib/referrals";
import { payNow } from "./pay-actions";
import { amountDueNow, type DraftOptions } from "@/lib/orders";
import { firstChoices, priceBreakdown, VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import { previewBackground } from "@/lib/print-kit";
import { draftPhotoUrl } from "@/lib/draft-photo";
import { saveStep } from "./actions";
import { TreeBuilder } from "@/components/TreeBuilder";
import { VariantPicker } from "@/components/VariantPicker";
import { PhotoPicker } from "@/components/PhotoPicker";

export const metadata = { title: "Design your order" };
export const dynamic = "force-dynamic";

/**
 * Three steps to payment, for every product: the details (or the tree, built by tapping it),
 * the choices (with one already picked), and pay. Nothing else stands between a family and
 * placing their order: no account form, no cart, no separate consent page.
 */
const FLOW_FORM = ["details", "choose", "pay"] as const;
const FLOW_BUILD = ["build", "choose", "pay"] as const;
const STEP_LABEL = { build: "Family", details: "Details", choose: "Choose", pay: "Pay" } as const;
const field = "mt-1 w-full rounded-lg border px-4 py-3 text-base";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;
const btn = "w-full rounded-lg bg-brand-600 px-5 py-3.5 text-base font-medium text-white hover:bg-brand-700";
const back = "block text-center text-sm underline";

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
  const before = Math.max(step - 1, 1);
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
    if (f.photo) return <PhotoPicker key={f.key} label={f.label} current={photoHref} />;
    if (f.choices) {
      return (
        <label key={f.key}>
          {label(f.label)}
          {f.hint && <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>{f.hint}</span>}
          <select name={f.key} defaultValue={(o[f.key] as string | undefined) ?? f.choices[0]?.[0]} className={field} style={fieldStyle}>
            {f.choices.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
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

  // Step 3 needs to know who is paying, what they already gave us, and who sent them.
  const payStep = current === "pay";
  const consentNeeded = payStep && (!me || (await userConsentState(me.id)).stale);
  const questions = payStep && me ? await findMatchQuestions(me.id, [item]) : [];
  const meRow = payStep && me ? await db.user.findUnique({ where: { id: me.id }, select: { name: true, phone: true } }) : null;
  const lastOrder = payStep && me && !order.contactName
    ? await db.order.findFirst({ where: { userId: me.id, contactName: { not: null } }, orderBy: { createdAt: "desc" }, select: { contactName: true, contactPhone: true, deliveryText: true } })
    : null;
  const prefill = {
    name: order.contactName ?? lastOrder?.contactName ?? meRow?.name ?? "",
    phone: order.contactPhone ?? lastOrder?.contactPhone ?? (meRow?.phone ? `0${meRow.phone.replace(/^254/, "")}` : ""),
    address: order.deliveryText ?? lastOrder?.deliveryText ?? "",
  };
  const linked = payStep ? await referrerByCode((await cookies()).get(REF_COOKIE)?.value) : null;
  const referredBy = linked && linked.status === "ACTIVE" && linked.userId !== me?.id ? linked : null;
  const choices = VARIANT_GROUPS.flatMap((g) => {
    const c = po?.[g.list]?.find((x) => x.key === previewOptions[g.key]);
    return c ? [c.label] : [];
  });
  const headline = o.title?.trim() || [o.first, o.surname].filter(Boolean).join(" ") || o.surname || "";
  const hasOptional = step2.fields.some((f) => !f.relation && (o[f.key] as string | undefined)?.trim());

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-6">
      <div className="flex items-center justify-between text-sm">
        <Link href={step > 1 ? `/order/${token}?step=${before}` : `/shop/${item.product.slug}`} style={{ color: "var(--muted)" }} aria-label="Back">←</Link>
        <span className="font-medium">{item.product.name}</span>
        {/* the live total is on step 2; up here only once it is settled */}
        <span style={{ color: "var(--muted)" }}>{payStep ? kes(amountDueNow(price)) : ""}</span>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2 text-xs" aria-label="Steps">
        {flow.map((f, i) => (
          <li key={f} aria-current={i + 1 === step ? "step" : undefined}>
            <div className="h-1.5 rounded-full" style={{ background: i + 1 <= step ? "var(--color-brand-600, #1d6b4f)" : "var(--border)" }} />
            <span className="mt-1 block" style={{ color: i + 1 === step ? "var(--fg)" : "var(--muted)", fontWeight: i + 1 === step ? 600 : 400 }}>
              {i + 1}. {STEP_LABEL[f]}
            </span>
          </li>
        ))}
      </ol>

      {error && <p role="alert" className="mt-4 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}

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

      {current === "details" && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">{step1.title}</h1>
          {step1.fields.map(renderField)}
          {step2.fields.length > 0 && (
            <details open={hasOptional} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <summary className="cursor-pointer text-sm font-medium">{step2.title} <span style={{ color: "var(--muted)" }}>(optional)</span></summary>
              <div className="mt-4 flex flex-col gap-4">
                {step2.intro && <p className="text-sm" style={{ color: "var(--muted)" }}>{step2.intro}</p>}
                {step2.fields.map(renderField)}
              </div>
            </details>
          )}
          <button className={btn}>Continue</button>
        </form>
      )}

      {current === "choose" && (
        <form action={save} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">Check and choose</h1>
          <VariantPicker
            basePriceKes={item.product.basePriceKes}
            po={po ?? {}}
            layout={layout}
            pathway={pathway}
            productName={item.product.name}
            origin={await publicOrigin()}
            options={previewOptions}
            initialSvg={previewSvg}
            initialWarnings={sheet.warnings}
            photoHref={photoHref}
            compact
          />
          {!isReady(layout, o) ? (
            <Link href={`/order/${token}?step=1`} className={`${btn} text-center`}>Add a name first</Link>
          ) : (
            <button className={btn}>Continue to pay</button>
          )}
          <Link href={`/order/${token}?step=${before}`} className={back}>Back</Link>
        </form>
      )}

      {payStep && (
        <form action={payNow.bind(null, token)} className="mt-6 flex flex-col gap-4">
          <h1 className="font-serif text-2xl">Pay</h1>
          <div className="flex gap-3 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="w-16 shrink-0 overflow-hidden rounded border" style={{ borderColor: "var(--border)", background: previewBackground(layout, previewOptions.finishKey) }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.product.name}{headline ? `: ${headline}` : ""}</p>
              <p style={{ color: "var(--muted)" }}>{choices.join(" · ")}</p>
              <p className="mt-1 text-base font-semibold">{kes(amountDueNow(price))} <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>delivery included</span></p>
            </div>
          </div>

          {questions.length > 0 && (
            <fieldset className="flex flex-col gap-3 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)" }}>
              <legend className="px-1 font-semibold">Is this someone already in your family?</legend>
              {questions.map((q) => (
                <div key={`${q.itemId}:${q.key}`} className="flex flex-col gap-1">
                  <p>You typed <strong>{q.typed}</strong> as {q.role}.</p>
                  {q.candidates.map((c) => (
                    <label key={c.id} className="flex items-start gap-2">
                      <input type="radio" required name={`match:${q.itemId}:${q.key}`} value={c.id} className="mt-1" />
                      <span>Yes, it is {c.name}{c.born ? `, born ${c.born}` : ""}{c.you ? " (you)" : ""}</span>
                    </label>
                  ))}
                  <label className="flex items-start gap-2">
                    <input type="radio" required name={`match:${q.itemId}:${q.key}`} value="new" className="mt-1" />
                    <span>No, a different person</span>
                  </label>
                </div>
              ))}
            </fieldset>
          )}

          <label><span className="text-sm font-medium">Your name</span>
            <input name="contactName" required autoComplete="name" defaultValue={prefill.name} className={field} style={fieldStyle} />
          </label>
          <label><span className="text-sm font-medium">M-Pesa number</span>
            <input name="contactPhone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" defaultValue={prefill.phone} className={field} style={fieldStyle} />
            <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>We send order updates here. No password needed.</span>
          </label>
          <label><span className="text-sm font-medium">Deliver to</span>
            <input name="deliveryText" required autoComplete="street-address" placeholder="Town and place, e.g. Ematsuli, Vihiga" defaultValue={prefill.address} className={field} style={fieldStyle} />
          </label>
          <details className="text-sm" open={Boolean(referredBy)}>
            <summary className="cursor-pointer" style={{ color: "var(--muted)" }}>{referredBy ? `Sent by ${referredBy.name}` : "Have a referral code?"}</summary>
            <input name="referralCode" defaultValue={referredBy?.code ?? ""} maxLength={20} autoCapitalize="characters" placeholder="e.g. UPENDO123" className={`${field} font-mono uppercase`} style={fieldStyle} />
          </details>
          {consentNeeded && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="agree" required className="mt-1" />
              <span style={{ color: "var(--muted)" }}>
                I agree to the <Link href="/policies/terms" className="underline">terms</Link>, <Link href="/policies/privacy" className="underline">privacy</Link> and <Link href="/policies/orders" className="underline">orders and refunds</Link> policies.
              </span>
            </label>
          )}
          <button className={btn}>Pay {kes(amountDueNow(price))}</button>
          <p className="text-center text-xs" style={{ color: "var(--muted)" }}>By M-Pesa on the next screen. Nothing is made until your payment is confirmed.</p>
          <Link href={`/order/${token}/add`} className={back} style={{ color: "var(--muted)" }}>Add to cart instead and keep shopping</Link>
        </form>
      )}
    </main>
  );
}
