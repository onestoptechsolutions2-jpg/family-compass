import Link from "next/link";

const WA = "254113352048"; // 0113352048

/**
 * Credit / contact footer. `links` renders extra site links before the credit
 * line (used on the marketing pages).
 */
export function SiteFooter({ links }: { links?: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-16 border-t pt-6 text-sm"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {links && <div className="mb-3">{links}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Designed &amp; developed by{" "}
          <a
            href="https://laitor.co.ke"
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:underline"
            style={{ color: "var(--fg)" }}
          >
            Leitor Investment Company Ltd
          </a>{" "}
          · 2017–{Math.max(year, 2027)}
        </span>
        <span aria-hidden>·</span>
        <a href="https://laitor.co.ke" target="_blank" rel="noreferrer" className="hover:underline">
          laitor.co.ke
        </a>
        <span aria-hidden>·</span>
        <a
          href={`https://wa.me/${WA}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
            <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.86 9.86 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.8 14.02c-.24.68-1.42 1.32-1.95 1.36-.5.04-.5.4-3.15-.66-2.66-1.05-4.3-3.76-4.43-3.94-.13-.18-1.05-1.4-1.05-2.66 0-1.26.66-1.88.9-2.14.24-.26.52-.32.7-.32l.5.01c.16 0 .38-.06.59.45.24.58.8 2 .87 2.14.07.14.12.31.02.5-.1.18-.15.3-.3.46-.14.18-.3.39-.43.53-.14.14-.29.3-.12.58.16.28.72 1.18 1.54 1.91 1.06.95 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.17-.2.7-.81.88-1.09.18-.28.36-.23.6-.14.25.09 1.58.75 1.85.89.28.14.46.2.53.32.07.12.07.68-.17 1.36Z" />
          </svg>
          0113352048
        </a>
        <span aria-hidden>·</span>
        <a href="mailto:partnerships@laitor.co.ke" className="hover:underline">
          partnerships@laitor.co.ke
        </a>
      </div>
    </footer>
  );
}
