"use client";

import { useEffect, useRef, useState } from "react";

import { renderPrintSheet } from "@/lib/print-sheet";
import { cleanName, getSlot, removeSlot, setSlot, slotLabel } from "@/lib/tree-edit";
import type { DraftOptions } from "@/lib/order-shared";
import type { Layout, Pathway } from "@/lib/layouts";
import { priceBreakdown, type ProductOptions } from "@/lib/product-pricing";
import { kes } from "@/lib/money";
import { autosaveBuilder, continueBuilder } from "@/app/order/[token]/builder-actions";

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;
const btn = "rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50";
const ghost = "rounded-md border px-4 py-2.5 text-sm";
const ghostStyle = { borderColor: "var(--border)" } as const;

const RELATIONS = [
  ["child", "Son or daughter"],
  ["spouse", "Husband or wife"],
  ["sibling", "Brother or sister"],
  ["other", "Other relative or friend"],
] as const;

type Props = {
  token: string;
  slug: string;
  initial: DraftOptions;
  pathway: Pathway;
  layout: Layout;
  origin: string;
  materialKey?: string;
  finishKey?: string;
  productName: string;
  /** so the price can be shown as the tree grows */
  pricing?: { basePriceKes: number; po: ProductOptions; sizeKey?: string };
};

/**
 * The family tree as the editor: the real piece, drawn as it will be made, where
 * every person and every dashed "+" can be tapped. No account is needed; the tree
 * is saved as you go under a private link that only this browser (and whoever you
 * send it to) holds.
 */
export function TreeBuilder({ token, slug, initial, pathway, layout, origin, materialKey, finishKey, productName, pricing }: Props) {
  const [options, setOptions] = useState<DraftOptions>(initial);
  const [svg, setSvg] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [death, setDeath] = useState("");
  const [flash, setFlash] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);
  const remembered = pathway === "REMEMBERED";

  // A phone gets a tall tree it can read and tap; a wider screen gets a squarer one.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // This browser remembers the private link, so coming back offers to carry on.
  useEffect(() => {
    try {
      localStorage.setItem(`fc:draft:${slug}`, token);
    } catch {
      /* private mode: the link in the address bar still works */
    }
  }, [slug, token]);

  // Draw the tree again whenever it changes.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const sizeKey = narrow ? "standard" : "square";
      const r = await renderPrintSheet(
        { options: { ...options, materialKey, finishKey, sizeKey }, productName, qrUrl: `${origin}/q/yourcode`, pathway, layout, interactive: true },
        sizeKey,
      );
      if (live) setSvg(r.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%"'));
    }, 40);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [options, narrow, materialKey, finishKey, productName, origin, pathway, layout]);

  // Save quietly as they go.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        const r = await autosaveBuilder(token, JSON.stringify(options));
        setStatus(r.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [options, token]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [editing]);

  const open = (slot: string) => {
    setFlash("");
    setEditing(slot);
    setName(slot.endsWith(":new") ? "" : getSlot(options, slot));
    if (slot === "focus") {
      setBirth(options.birth ?? "");
      setDeath(options.death ?? "");
    }
  };
  const slotOf = (el: EventTarget | null) => (el as Element | null)?.closest?.("[data-slot]")?.getAttribute("data-slot") ?? null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const cleaned = cleanName(name);
    if (editing === "focus") {
      setOptions((o) => ({
        ...setSlot(o, "focus", name),
        birth: cleanName(birth, 60),
        ...(remembered ? { death: cleanName(death, 60) } : {}),
      }));
      setEditing(null);
      return;
    }
    if (editing.endsWith(":new") && !cleaned) {
      setEditing(null);
      return;
    }
    setOptions((o) => setSlot(o, editing, cleaned));
    if (editing.endsWith(":new")) {
      // the same place stays open, so a whole family can be added in a row
      setFlash(`Added ${cleaned}. Add another, or tap Done.`);
      setName("");
    } else {
      setEditing(null);
    }
  };

  const filled = editing ? Boolean(getSlot(options, editing)) : false;
  const hasName = Boolean([options.first, options.surname].filter(Boolean).join(" ").trim());
  const priced = pricing ? priceBreakdown(pricing.basePriceKes, pricing.po, layout, { ...options, materialKey, finishKey, sizeKey: pricing.sizeKey }) : null;
  const set = (k: keyof DraftOptions) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setOptions((o) => ({ ...o, [k]: e.target.value }));

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Tap a person to change them, or a dashed <strong>+</strong> to add someone. This is the real piece, and it updates as you go.
        Nothing to sign in to. Your tree is private: only you can open it.
      </p>

      {layout === "banner" && (
        <label className="text-sm">
          <span className="font-medium">Banner title</span>
          <input value={options.title ?? ""} onChange={set("title")} placeholder="e.g. Kamau Family Reunion 2026" className={field} style={fieldStyle} />
        </label>
      )}

      <div
        className="mx-auto w-full max-w-md overflow-hidden rounded-xl border sm:max-w-xl"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => {
          const s = slotOf(e.target);
          if (s) open(s);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          const s = slotOf(e.target);
          if (s) {
            e.preventDefault();
            open(s);
          }
        }}
        dangerouslySetInnerHTML={{ __html: svg || '<div style="padding:3rem;text-align:center;opacity:.6">Drawing your tree…</div>' }}
      />

      {editing && (
        <form ref={panelRef} onSubmit={save} className="rounded-xl border p-4" style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}>
          <h3 className="font-semibold">{editing === "focus" ? "About this person" : slotLabel(editing)}</h3>
          {flash && <p className="mt-1 text-sm" style={{ color: "var(--success, #15803d)" }}>{flash}</p>}
          <label className="mt-3 block text-sm">
            <span className="font-medium">{editing === "focus" ? (remembered ? "Their full name" : "Your full name") : "Full name"}</span>
            <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" className={field} style={fieldStyle} />
          </label>
          {editing === "focus" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="font-medium">{remembered ? "Born (year)" : "Your birth year (optional)"}</span>
                <input value={birth} onChange={(e) => setBirth(e.target.value)} inputMode="numeric" maxLength={60} className={field} style={fieldStyle} />
              </label>
              {remembered && (
                <label className="text-sm">
                  <span className="font-medium">Died (year)</span>
                  <input value={death} onChange={(e) => setDeath(e.target.value)} inputMode="numeric" maxLength={60} className={field} style={fieldStyle} />
                </label>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btn}>{editing === "focus" || filled ? "Save" : "Add"}</button>
            {filled && editing !== "focus" && (
              <button type="button" className={ghost} style={ghostStyle} onClick={() => { setOptions((o) => removeSlot(o, editing)); setEditing(null); }}>
                Remove
              </button>
            )}
            <button type="button" className={ghost} style={ghostStyle} onClick={() => setEditing(null)}>
              {flash ? "Done" : "Cancel"}
            </button>
          </div>
        </form>
      )}

      {(remembered || layout === "tree") && (
        <div className="grid gap-3 sm:grid-cols-2">
          {remembered ? (
            <>
              <label className="text-sm">
                <span className="font-medium">Place of burial (optional)</span>
                <input value={options.place ?? ""} onChange={set("place")} className={field} style={fieldStyle} />
              </label>
              <label className="text-sm">
                <span className="font-medium">You are their</span>
                <select value={options.relation ?? "other"} onChange={set("relation")} className={field} style={fieldStyle}>
                  {RELATIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-medium">A short line to carry on it (optional)</span>
                <input value={options.epitaph ?? ""} onChange={set("epitaph")} maxLength={300} className={field} style={fieldStyle} />
              </label>
            </>
          ) : (
            <label className="text-sm sm:col-span-2">
              <span className="font-medium">A title for your tree (optional)</span>
              <input value={options.epitaph ?? ""} onChange={set("epitaph")} maxLength={300} className={field} style={fieldStyle} />
            </label>
          )}
        </div>
      )}

      {priced && priced.generations !== null && (
        <p className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }} aria-live="polite">
          <strong>{priced.generations} {priced.generations === 1 ? "generation" : "generations"}</strong> so far · from <strong>{kes(priced.total)}</strong>, delivery included.
          {priced.included !== null && pricing?.po.generations && (
            <span style={{ color: "var(--muted)" }}> The price includes {priced.included}; each extra adds {kes(pricing.po.generations.perExtraKes)}.</span>
          )}
        </p>
      )}

      <form action={continueBuilder.bind(null, token)} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="options" value={JSON.stringify(options)} />
        <button className={btn} disabled={!hasName}>Continue: choose material and size</button>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {!hasName ? "Tap the middle to add a name first." : status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Could not save just now; Continue will save it." : ""}
        </span>
      </form>
    </div>
  );
}
