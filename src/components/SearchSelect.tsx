"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchOption = { value: string; label: string; hint?: string };

const CREATE_PREFIX = "new:";

/**
 * A type-ahead replacement for a `<select>` when the list is a set of entities
 * (people, places, clans, families…). Submits like a native control: a hidden
 * input named `name` carries the chosen value(s), so it drops straight into a
 * server-action form. Keyboard: ↑ ↓ Enter Esc.
 *
 * With `allowCreate`, a "＋ Add …" row appears when the typed text matches no
 * option; picking it submits `new:<text>` and the server action is expected to
 * create the entity and resolve it.
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
  allowCreate = false,
  createLabel = (q: string) => `＋ Add “${q}”`,
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
  allowCreate?: boolean;
  createLabel?: (q: string) => string;
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

  const raw = query.trim();
  const q = raw.toLowerCase();
  const matches = useMemo(() => {
    const pool = multiple ? options.filter((o) => !selected.includes(o.value)) : options;
    const hit = q ? pool.filter((o) => o.label.toLowerCase().includes(q)) : pool;
    return hit.slice(0, 50);
  }, [options, selected, q, multiple]);

  const canCreate =
    allowCreate && !multiple && raw.length > 1 && !options.some((o) => o.label.toLowerCase() === q);

  type Row = { kind: "empty" } | { kind: "option"; o: SearchOption } | { kind: "create" };
  const rows: Row[] = [
    ...(allowEmpty && !multiple ? [{ kind: "empty" } as Row] : []),
    ...matches.map((o) => ({ kind: "option", o }) as Row),
    ...(canCreate ? [{ kind: "create" } as Row] : []),
  ];

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
  const runRow = (r: Row | undefined) => {
    if (!r) return;
    if (r.kind === "empty") {
      clearSingle();
      setOpen(false);
    } else if (r.kind === "option") {
      pick(r.o.value);
    } else {
      pick(`${CREATE_PREFIX}${raw}`);
    }
  };

  const single = !multiple ? selected[0] : undefined;
  const singleLabel = single
    ? single.startsWith(CREATE_PREFIX)
      ? `＋ ${single.slice(CREATE_PREFIX.length)}`
      : (byValue.get(single)?.label ?? "")
    : "";
  const inputValue = open || multiple ? query : singleLabel;

  const box = "w-full rounded-lg border px-3 py-2 text-sm";
  const style = { borderColor: "var(--border)", background: "var(--surface-2, var(--bg))" } as const;

  return (
    <div ref={wrap} className={`relative ${className ?? ""}`}>
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
          placeholder={!multiple && selected[0] && !open ? singleLabel : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runRow(rows[active]);
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
          {rows.map((r, i) => {
            const on = i === active;
            const bg = on ? "var(--surface-2)" : undefined;
            if (r.kind === "empty") {
              return (
                <li
                  key="__empty"
                  role="option"
                  aria-selected={selected.length === 0}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    runRow(r);
                  }}
                  className="cursor-pointer px-3 py-1.5"
                  style={{ background: bg, color: "var(--muted)" }}
                >
                  {emptyLabel}
                </li>
              );
            }
            if (r.kind === "create") {
              return (
                <li
                  key="__create"
                  role="option"
                  aria-selected={false}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    runRow(r);
                  }}
                  className="cursor-pointer px-3 py-1.5 font-medium"
                  style={{ background: bg, color: "var(--color-brand-700)" }}
                >
                  {createLabel(raw)}
                </li>
              );
            }
            return (
              <li
                key={r.o.value}
                role="option"
                aria-selected={selected.includes(r.o.value)}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  runRow(r);
                }}
                className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5"
                style={{ background: bg }}
              >
                <span className="truncate">{r.o.label}</span>
                {r.o.hint && (
                  <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>{r.o.hint}</span>
                )}
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-3 py-1.5 text-xs" style={{ color: "var(--muted)" }}>
              {raw ? `No match for “${raw}”` : "No options"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
