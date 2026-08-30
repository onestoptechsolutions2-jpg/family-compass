import type { CSSProperties } from "react";

/**
 * Public-memorial page templates. Each is a set of CSS-variable overrides plus
 * a few layout switches; the page markup stays the same and only re-skins.
 */
export type MemorialTemplateId = "classic" | "linkedin" | "stripe" | "x";

export const MEMORIAL_TEMPLATES: { id: MemorialTemplateId; label: string; blurb: string }[] = [
  { id: "classic", label: "Classic", blurb: "Warm parchment, serif headings — a printed-programme feel." },
  { id: "linkedin", label: "Profile", blurb: "Banner, avatar and clean sectioned cards, LinkedIn-style." },
  { id: "stripe", label: "Modern", blurb: "Big airy gradient hero, generous whitespace, Stripe-style." },
  { id: "x", label: "Feed", blurb: "Compact, dark-friendly, tributes as a running feed like X." },
];

export function isTemplateId(v: string): v is MemorialTemplateId {
  return MEMORIAL_TEMPLATES.some((t) => t.id === v);
}

export type TemplateTheme = {
  /** inline style for the page <main> wrapper (CSS var overrides + base) */
  wrapper: CSSProperties;
  hero: "band" | "banner" | "gradient" | "minimal";
  headingFont: string;
  card: CSSProperties;
  /** guestbook rendered as a feed (avatars + time-ago) vs. simple list */
  feed: boolean;
  accent: string;
};

const SERIF = 'Iowan Old Style, "Palatino Linotype", Palatino, Georgia, serif';
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function templateTheme(id: string): TemplateTheme {
  switch (id) {
    case "linkedin":
      return {
        wrapper: {
          "--bg": "#f4f2ee",
          "--surface": "#ffffff",
          "--surface-2": "#f3f6f8",
          "--fg": "#1d2226",
          "--muted": "#5e6b74",
          "--border": "#e2e2df",
          "--hairline": "#ececec",
          "--accent": "#0a66c2",
          "--link": "#0a66c2",
          background: "var(--bg)",
          fontFamily: SANS,
        } as CSSProperties,
        hero: "banner",
        headingFont: SANS,
        card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 1px 2px rgb(0 0 0 / 0.08)" },
        feed: true,
        accent: "#0a66c2",
      };
    case "stripe":
      return {
        wrapper: {
          "--bg": "#ffffff",
          "--surface": "#ffffff",
          "--surface-2": "#f6f9fc",
          "--fg": "#0a2540",
          "--muted": "#425466",
          "--border": "#e6ebf1",
          "--hairline": "#eef2f6",
          "--accent": "#635bff",
          "--link": "#635bff",
          background: "var(--bg)",
          fontFamily: SANS,
        } as CSSProperties,
        hero: "gradient",
        headingFont: SANS,
        card: { background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, boxShadow: "0 8px 24px rgb(10 37 64 / 0.06)" },
        feed: false,
        accent: "#635bff",
      };
    case "x":
      return {
        wrapper: {
          "--bg": "#0b0e11",
          "--surface": "#15191e",
          "--surface-2": "#1b2027",
          "--fg": "#e7e9ea",
          "--muted": "#8b98a5",
          "--border": "#2a323c",
          "--hairline": "#232a32",
          "--accent": "#1d9bf0",
          "--link": "#1d9bf0",
          background: "var(--bg)",
          color: "var(--fg)",
          fontFamily: SANS,
        } as CSSProperties,
        hero: "minimal",
        headingFont: SANS,
        card: { background: "transparent", borderBottom: "1px solid var(--hairline)", borderRadius: 0 },
        feed: true,
        accent: "#1d9bf0",
      };
    default: // classic
      return {
        wrapper: { background: "var(--bg)", fontFamily: SANS } as CSSProperties,
        hero: "band",
        headingFont: SERIF,
        card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 },
        feed: false,
        accent: "var(--accent)",
      };
  }
}
