"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchOption = { value: string; label: string; hint?: string };

/**
 * A type-ahead replacement for a `<select>` when the list is a set of entities
 * (people, places, clans, families…). Submits like a native control: a hidden
 * input named `name` carries the chosen value(s), so it drops straight into a
 * server-action form. Keyboard: ↑ ↓ Enter Esc.
 */
export function SearchSelect({
  name,
  options,
  defaultValue,
  placeholder = "Type to search…",
  allowEmpty = true,
  emptyLabel = "— none —",
  required = false,
  multiple = false,
  className,
}: {
  name: string;
  options: SearchOption[];
  defaultValue?: string | string[] | null;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
  multiple?: boolean;
  className?: string;
}) {
  const listId = useId();
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const initial = Array.isArray(defaultValue)
    ? defaultValue.filter(Boolean)
    : defaultValue
      ? [defaultValue]
      : [];
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const pool = multiple ? options.filter((o) => !selected.includes(o.value)) : options;
    const hit = q ? pool.filter((o) => o.label.toLowerCase().includes(q)) : pool;
    return hit.slice(0, 50);
  }, [options, selected, q, multiple]);

  useEffect(() => setActive(0), [q, open]);

  const pick = (value: string) => {
    if (multiple) {
      setSelected((s) => (s.includes(value) ? s : [...s, value]));
      setQuery("");
      input.current?.focus();
    } else {
      setSelected([value]);
      setOpen(false);
      setQuery("");
      input.current?.blur();
    }
  };
  const remove = (value: string) => setSelected((s) => s.filter((v) => v !== value));
  const clearSingle = () => {
    setSelected([]);
    setQuery("");
    input.current?.focus();
  };

  const singleLabel = !multiple && selected[0] ? (byValue.get(selected[0])?.label ?? "") : "";
  const inputValue = open || multiple ? query : singleLabel;

  const box = "w-full rounded-lg border px-3 py-2 text-sm";
  const style = { borderColor: "var(--border)", background: "var(--surface-2, var(--bg))" } as const;

  return (
    <div ref={wrap} className={`relative ${className ?? ""}`}>
      {/* hidden values for the form */}
      {(multiple ? selected : selected.slice(0, 1)).map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      {multiple && selected.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {selected.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
            >
              {byValue.get(v)?.label ?? v}
              <button type="button" onClick={() => remove(v)} aria-label="Remove" className="hover:opacity-70">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          required={required && !multiple && selected.length === 0}
          value={inputValue}
          placeholder={
            !multiple && selected[0] && !open ? singleLabel : placeholder
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, matches.length - 1 + (allowEmpty && !multiple ? 1 : 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const emptyRow = allowEmpty && !multiple ? 1 : 0;
              if (emptyRow && active === matches.length) {
                clearSingle();
                setOpen(false);
              } else {
                const o = matches[active];
                if (o) pick(o.value);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            } else if (e.key === "Backspace" && multiple && !query && selected.length) {
              remove(selected[selected.length - 1]!);
            }
          }}
          className={box}
          style={style}
        />
        {!multiple && selected[0] && (
          <button
            type="button"
            onClick={clearSingle}
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: "var(--muted)" }}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border py-1 text-sm shadow-lg"
          style={{ borderColor: "var(--border)", background: "var(--surface, var(--bg))" }}
        >
          {allowEmpty && !multiple && (
            <li
              role="option"
              aria-selected={selected.length === 0}
              onMouseDown={(e) => {
                e.preventDefault();
                clearSingle();
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-1.5"
              style={{ background: active === matches.length ? "var(--surface-2)" : undefined, color: "var(--muted)" }}
            >
              {emptyLabel}
            </li>
          )}
          {matches.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={selected.includes(o.value)}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o.value);
              }}
              className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5"
              style={{ background: i === active ? "var(--surface-2)" : undefined }}
            >
              <span className="truncate">{o.label}</span>
              {o.hint && (
                <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>{o.hint}</span>
              )}
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-1.5 text-xs" style={{ color: "var(--muted)" }}>
              {q ? `No match for “${query.trim()}”` : "No options"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
