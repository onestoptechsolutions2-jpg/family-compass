"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: "var(--border)" }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
