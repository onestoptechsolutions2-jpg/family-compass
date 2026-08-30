"use client";

import { useRef } from "react";

export function Dialog({
  label,
  title,
  children,
  buttonClass,
  wide = false,
}: {
  label: React.ReactNode;
  title: string;
  children: React.ReactNode;
  buttonClass?: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={buttonClass ?? "rounded-lg border px-3 py-1.5 text-xs font-medium"}
        style={buttonClass ? undefined : { borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {label}
      </button>

      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        style={{ maxWidth: wide ? "min(94vw, 44rem)" : undefined }}
      >
        <form method="dialog" className="contents">
          <div
            className="flex items-center justify-between gap-4 border-b px-5 py-3.5"
            style={{ borderColor: "var(--hairline)" }}
          >
            <h3 className="font-serif text-lg leading-tight">{title}</h3>
            <button
              type="submit"
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-full text-sm"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
            >
              ✕
            </button>
          </div>
        </form>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}
