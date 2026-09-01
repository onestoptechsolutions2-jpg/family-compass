"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { InstallPrompt } from "./InstallPrompt";
import { PushSetup } from "./PushSetup";

export type WizardStep = { done: boolean; label: string; href: string; cta: string };

/**
 * Getting-started checklist for someone who just claimed their own profile.
 * Shows until every step is done or the person hides it; `force` (the
 * ?welcome=1 landing) reveals it even after a hide.
 */
export function ClaimedWizard({
  personId,
  treeName,
  steps,
  force,
}: {
  personId: string;
  treeName: string;
  steps: WizardStep[];
  force?: boolean;
}) {
  const key = `fc_wizard_hidden_${personId}`;
  const doneCount = steps.filter((s) => s.done).length;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (force) {
      setHidden(false);
      return;
    }
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key, force]);

  if (doneCount === steps.length) return null;

  const show = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setHidden(false);
  };
  const hide = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  if (hidden) {
    return (
      <button onClick={show} className="self-start text-xs hover:underline" style={{ color: "var(--link)" }}>
        Show setup checklist ({doneCount}/{steps.length})
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
            Welcome to {treeName}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">This is your profile</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            A few things to set up — {doneCount} of {steps.length} done. The tree always opens
            centred on you.
          </p>
        </div>
        <button onClick={hide} className="shrink-0 text-xs hover:underline" style={{ color: "var(--muted)" }}>
          hide
        </button>
      </div>
      <ol className="flex flex-col gap-1.5 text-sm">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span style={{ color: s.done ? "var(--success)" : "var(--muted)" }}>{s.done ? "✓" : "○"}</span>
            <span style={s.done ? { color: "var(--muted)", textDecoration: "line-through" } : undefined}>
              {s.label}
            </span>
            {!s.done && (
              <Link href={s.href} className="ml-auto shrink-0 text-xs hover:underline" style={{ color: "var(--link)" }}>
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ol>
      <InstallPrompt />
      <PushSetup compact />
    </div>
  );
}
