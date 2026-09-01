"use client";

export function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide rounded-md border px-3 py-1.5"
      style={{ borderColor: "var(--border)" }}
    >
      {label}
    </button>
  );
}
