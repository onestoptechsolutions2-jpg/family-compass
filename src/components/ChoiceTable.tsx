"use client";

import { useState } from "react";

type Row = { key: string; label: string; addKes: string; perCopyKes: string };

/** A choice's key from its name: "Full colour" → "full-colour". Existing keys never change. */
const keyFrom = (label: string) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "choice";

/**
 * The prices of one group of choices (paper, colour, size, pages, copies) as a small table:
 * name, price, price per copy. It sends the same lines the server has always read
 * ("key|label|price|per copy"), so nothing about saving changes. A choice that already exists
 * keeps its key, because orders and print files refer to it; a number of copies is its own key.
 */
export function ChoiceTable({
  name,
  title,
  copies = false,
  initial,
}: {
  name: string;
  title: string;
  /** the Copies group: each row is a number of copies, and has no per-copy price of its own */
  copies?: boolean;
  initial: { key: string; label: string; addKes: number; perCopyKes?: number }[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((c) => ({ key: c.key, label: c.label, addKes: String(c.addKes), perCopyKes: c.perCopyKes !== undefined ? String(c.perCopyKes) : "" })),
  );
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  // keys: kept for existing choices; made from the name (or the number of copies) for new ones, and unique
  const used = new Set<string>();
  // copies are offered smallest first, whatever order they were typed in
  const ordered = copies ? [...rows].sort((a, b) => (Number(a.label.replace(/\D/g, "")) || 0) - (Number(b.label.replace(/\D/g, "")) || 0)) : rows;
  const lines = ordered
    .filter((r) => r.label.trim())
    .map((r) => {
      // the copies charged for are read from the key, so for copies the key is always the number typed
      let key = copies ? r.label.replace(/\D/g, "") : r.key || keyFrom(r.label);
      while (used.has(key)) key = `${key}-2`;
      used.add(key);
      const label = copies ? `${Number(r.label.replace(/\D/g, "")) || r.label} copies` : r.label.trim();
      const parts = [key, label, r.addKes.trim() || "0"];
      if (!copies && r.perCopyKes.trim()) parts.push(r.perCopyKes.trim());
      return parts.join("|");
    });

  const cell = "w-full rounded-md border px-2 py-1.5 text-sm";
  const cellStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;
  return (
    <fieldset className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <legend className="px-1 text-xs font-medium">{title}</legend>
      <input type="hidden" name={name} value={lines.join("\n")} />
      {rows.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>Not offered. Add a choice to offer it.</p>}
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_6rem_6rem_auto] items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
          <span>{copies ? "Number of copies" : "Name"}</span>
          <span>Price (KES)</span>
          <span>{copies ? "" : "Per copy (KES)"}</span>
          <span />
          {rows.map((r, i) => (
            <div key={i} className="contents">
              <input
                value={r.label}
                onChange={(e) => set(i, { label: e.target.value })}
                inputMode={copies ? "numeric" : undefined}
                placeholder={copies ? "e.g. 200" : "e.g. Full colour"}
                aria-label={`${title}: name`}
                className={cell}
                style={cellStyle}
              />
              <input value={r.addKes} onChange={(e) => set(i, { addKes: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="0" aria-label={`${title}: price`} className={cell} style={cellStyle} />
              {copies ? (
                <span />
              ) : (
                <input value={r.perCopyKes} onChange={(e) => set(i, { perCopyKes: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="—" aria-label={`${title}: price per copy`} className={cell} style={cellStyle} />
              )}
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="px-1 text-base" aria-label={`Remove ${r.label || "this choice"}`} style={{ color: "var(--danger)" }}>×</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setRows((r) => [...r, { key: "", label: "", addKes: "0", perCopyKes: "" }])} className="mt-2 text-xs underline">
        + Add a choice
      </button>
    </fieldset>
  );
}
