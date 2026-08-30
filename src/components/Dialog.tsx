"use client";

import { useRef } from "react";

export function Dialog({
  label,
  title,
  children,
  buttonClass,
}: {
  label: React.ReactNode;
  title: string;
  children: React.ReactNode;
  buttonClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={
          buttonClass ??
          "rounded-lg border px-3 py-1.5 text-xs"
        }
        style={buttonClass ? undefined : { borderColor: "var(--border)" }}
      >
        {label}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="w-full max-w-md rounded-xl border p-0 backdrop:bg-black/40"
        style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--fg)" }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{title}</h3>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="text-sm"
              style={{ color: "var(--muted)" }}
            >
              ✕
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </dialog>
    </>
  );
}
