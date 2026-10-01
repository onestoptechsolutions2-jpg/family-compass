"use client";

import { useEffect, useRef, useState } from "react";

import { renderPrintSheet } from "@/lib/print-sheet";
import { previewBackground, SHIRT_COLOURS } from "@/lib/print-kit";
import { priceBreakdown, VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import type { DraftOptions } from "@/lib/order-shared";
import type { Layout, Pathway } from "@/lib/layouts";
import { kes } from "@/lib/money";

const SWATCH: Record<string, string> = {
  black: "#22262e", grey: "#7a8088", light: "#c68f5b", dark: "#6b4328", white: "#ffffff", cream: "#f6f0e1", oak: "#c9a36b",
  navy: SHIRT_COLOURS.navy!.shirt, maroon: SHIRT_COLOURS.maroon!.shirt,
};

type Props = {
  basePriceKes: number;
  po: ProductOptions;
  layout: Layout;
  pathway: Pathway;
  productName: string;
  origin: string;
  /** what the customer has built so far, and any variants already chosen */
  options: DraftOptions;
  /** the preview drawn on the server for the choices already made, so the page is complete before it loads */
  initialSvg: string;
};

/**
 * Material, colour and size as large, tappable choices. The price, and a picture of
 * the piece in the chosen colour, update as each choice is made, so nothing about
 * the cost is a surprise at the cart.
 */
export function VariantPicker({ basePriceKes, po, layout, pathway, productName, origin, options, initialSvg }: Props) {
  const groups = VARIANT_GROUPS.map((g) => ({ ...g, items: po[g.list] ?? [] })).filter((g) => g.items.length);
  const [sel, setSel] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, g.items.some((c) => c.key === options[g.key]) ? (options[g.key] as string) : g.items[0]!.key])),
  );
  const chosen: DraftOptions = { ...options, ...sel };
  const priced = priceBreakdown(basePriceKes, po, layout, chosen);
  const [svg, setSvg] = useState(initialSvg);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let live = true;
    renderPrintSheet(
      { options: chosen, productName, qrUrl: `${origin}/q/yourcode`, pathway, layout },
      chosen.sizeKey,
    ).then((r) => live && setSvg(r.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%"')));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <fieldset key={g.key} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
          <legend className="px-1 text-sm font-medium">{g.title}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {g.items.map((c) => {
              const on = sel[g.key] === c.key;
              return (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
                  style={{ borderColor: on ? "var(--color-brand-600, #1d6b4f)" : "var(--border)", background: on ? "var(--card)" : undefined, boxShadow: on ? "0 0 0 1px var(--color-brand-600, #1d6b4f)" : undefined }}
                >
                  <input type="radio" name={g.key} value={c.key} checked={on} onChange={() => setSel((s) => ({ ...s, [g.key]: c.key }))} className="sr-only" />
                  {g.key === "finishKey" && SWATCH[c.key] && (
                    <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border" style={{ background: SWATCH[c.key], borderColor: "var(--border)" }} />
                  )}
                  <span className="min-w-0 flex-1">{c.label}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>{c.addKes ? `+${kes(c.addKes)}` : "included"}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }} aria-live="polite">
        <div className="flex justify-between"><span>{productName}</span><span>{kes(priced.base)}</span></div>
        {priced.adds.map((a) => (
          <div key={a.label} className="mt-1 flex justify-between" style={{ color: "var(--muted)" }}><span>{a.label}</span><span>+{kes(a.kes)}</span></div>
        ))}
        {priced.generations !== null && priced.included !== null && (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Your piece shows {priced.generations} {priced.generations === 1 ? "generation" : "generations"}. The price includes {priced.included}; each extra generation adds {kes(po.generations?.perExtraKes ?? 0)}.
          </p>
        )}
        <div className="mt-3 flex items-baseline justify-between border-t pt-3 text-base font-semibold" style={{ borderColor: "var(--border)" }}>
          <span>Total <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>· delivery included</span></span>
          <span>{kes(priced.total)}</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>Preview of your {productName.toLowerCase()}</p>
        <div
          className="mt-2 overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--border)", background: previewBackground(layout, sel.finishKey) ?? (layout === "shirt" ? "#e8e8e8" : undefined) }}
          dangerouslySetInnerHTML={{ __html: svg || '<div style="padding:3rem;text-align:center;opacity:.6">Drawing…</div>' }}
        />
      </div>
    </div>
  );
}
