"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { renderPrintSheet } from "@/lib/print-sheet";
import type { DraftOptions } from "@/lib/order-shared";
import { startFromLanding } from "@/app/start-order/actions";

type Mode = "living" | "remembered";

/** Shown until the visitor types a name, so the page never looks empty. */
const EXAMPLE: DraftOptions = {
  first: "Hesbon Okusimba",
  surname: "Musungu",
  birth: "1948",
  death: "2026",
  parents: "Joseph Musungu\nSelpha Ndakala",
  children: "Willy Okusimba\nBilly Okusimba\nJane Okusimba",
};

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;

/**
 * The first step of every order, on the landing page itself: a few plain
 * questions and the real finished product taking shape beside them.
 */
export function TreeStarter({ origin }: { origin: string }) {
  const [mode, setMode] = useState<Mode>("living");
  const [f, setF] = useState({ first: "", surname: "", birth: "", death: "", parents: "", children: "" });
  const [svg, setSvg] = useState("");

  const typed = f.first.trim().length > 0;
  const remembered = mode === "remembered";

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const o: DraftOptions = typed
        ? { ...f, death: remembered ? f.death : "" }
        : { ...EXAMPLE, death: remembered ? EXAMPLE.death : "" };
      const r = await renderPrintSheet(
        {
          options: { ...o, materialKey: remembered ? "granite" : "wood" },
          productName: "",
          qrUrl: `${origin}/q/yourcode`,
          pathway: remembered ? "REMEMBERED" : "LIVING",
        },
        remembered ? "square" : "wall",
      );
      if (live) setSvg(r.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%"'));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [f, mode, typed, remembered, origin]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <section
      id="start"
      className="mt-8 grid gap-6 rounded-3xl border p-5 sm:p-8 lg:grid-cols-[1fr_1.15fr]"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <form action={startFromLanding} className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl leading-tight text-[#3b2a1c] sm:text-4xl">Your family has a story.</h1>
        <p className="text-[#4a3728]">
          Tell us who it is for. Watch your family tree take shape as you type, then we make it and send it.
        </p>

        <input type="hidden" name="mode" value={mode} />
        <div className="mt-1 grid grid-cols-2 gap-2 text-sm font-medium" role="tablist" aria-label="Who is it for">
          {(
            [
              ["living", "🌳 My family", "The Living"],
              ["remembered", "🕊️ Someone we remember", "The Remembered"],
            ] as const
          ).map(([m, label, sub]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-xl border px-3 py-2 text-left ${mode === m ? "border-brand-600 bg-brand-50" : ""}`}
              style={mode === m ? undefined : { borderColor: "var(--border)" }}
            >
              <span className="block">{label}</span>
              <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>{sub}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="font-medium">{remembered ? "Their first name(s)" : "Your first name(s)"}</span>
            <input name="first" required value={f.first} onChange={set("first")} autoComplete="given-name" className={field} style={fieldStyle} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Surname</span>
            <input name="surname" value={f.surname} onChange={set("surname")} autoComplete="family-name" className={field} style={fieldStyle} />
          </label>
          <label className="text-sm">
            <span className="font-medium">{remembered ? "Born (year)" : "Your birth year"}</span>
            <input name="birth" value={f.birth} onChange={set("birth")} inputMode="numeric" className={field} style={fieldStyle} />
          </label>
          {remembered && (
            <label className="text-sm">
              <span className="font-medium">Died (year)</span>
              <input name="death" value={f.death} onChange={set("death")} inputMode="numeric" className={field} style={fieldStyle} />
            </label>
          )}
        </div>
        <label className="text-sm">
          <span className="font-medium">Parents</span>
          <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>father first, one per line</span>
          <textarea name="parents" rows={2} value={f.parents} onChange={set("parents")} className={field} style={fieldStyle} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Children</span>
          <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>one per line</span>
          <textarea name="children" rows={2} value={f.children} onChange={set("children")} className={field} style={fieldStyle} />
        </label>

        <button className="rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-50" disabled={!typed}>
          Continue: add grandparents and choose material
        </button>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          No account yet. You sign in only when you approve your design.{" "}
          <Link href={remembered ? "/remembered" : "/living"} className="underline">See all products</Link>
        </p>
      </form>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          {typed ? "Your family tree" : "Example: it fills in as you type"}
        </p>
        <div
          className="mt-2 overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)", minHeight: 240 }}
          aria-live="polite"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </section>
  );
}
