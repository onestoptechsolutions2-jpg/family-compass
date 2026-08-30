"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Save this memorial" — lets a visitor keep it: copy the link, add it to their
 * phone home screen, share it, or download a PDF.
 */
export function SaveMemorial({ url, pdfUrl, name }: { url: string; pdfUrl: string; name: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    const ua = window.navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /^((?!chrome|crios|fxios).)*safari/i.test(ua)) setIosHint(true);
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const btn =
    "rounded-full border px-4 py-2 text-sm font-medium";
  const btnStyle = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <p className="text-sm font-medium">Keep this memorial</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={copy} className={btn} style={btnStyle}>
          {copied ? "Link copied ✓" : "Copy link"}
        </button>

        <a href={pdfUrl} className={btn} style={btnStyle}>
          Download PDF
        </a>

        {canShare && (
          <button
            onClick={() =>
              navigator.share({ title: name, text: `In memory of ${name}`, url }).catch(() => {})
            }
            className={btn}
            style={btnStyle}
          >
            Share…
          </button>
        )}

        {deferred && (
          <button
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice.catch(() => {});
              setDeferred(null);
            }}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add to Home Screen
          </button>
        )}
      </div>

      {iosHint && !deferred && (
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          On iPhone: tap the Share button, then <strong>Add to Home Screen</strong> to keep this page.
        </p>
      )}
    </div>
  );
}
