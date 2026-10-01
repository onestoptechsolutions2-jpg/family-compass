/**
 * Every email the shop sends has the same shape: a heading, a few short paragraphs, one
 * button, and a plain-text version for mail apps that do not show formatting.
 * Pure, so it is tested without sending anything.
 */
export type EmailContent = {
  /** the first line, also the subject's partner */
  heading: string;
  paragraphs: string[];
  /** lines like "Wooden family tree x 1: KES 20,500", shown as a list */
  items?: string[];
  button?: { label: string; url: string };
  /** a small line under everything, e.g. why they got this */
  footnote?: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Only web addresses become links; anything else is dropped rather than put in an href. */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "");

export function renderEmail(c: EmailContent, brand = "Family Compass"): { text: string; html: string } {
  const url = c.button ? safeUrl(c.button.url) : "";
  const text = [
    c.heading,
    "",
    ...c.paragraphs.flatMap((p) => [p, ""]),
    ...(c.items?.length ? [...c.items.map((i) => `  ${i}`), ""] : []),
    ...(c.button && url ? [`${c.button.label}: ${url}`, ""] : []),
    ...(c.footnote ? [c.footnote, ""] : []),
    brand,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#3b2a1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e3dccd">
<tr><td style="padding:22px 28px 0;font:600 15px Arial,Helvetica,sans-serif;color:#3b2a1c">&#129517; ${esc(brand)}</td></tr>
<tr><td style="padding:14px 28px 4px"><h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:600">${esc(c.heading)}</h1></td></tr>
<tr><td style="padding:8px 28px 0;font:15px/1.55 Arial,Helvetica,sans-serif;color:#4a3728">
${c.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n")}
${c.items?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 12px;border-top:1px solid #e3dccd">${c.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e3dccd;font:14px Arial,Helvetica,sans-serif">${esc(i)}</td></tr>`).join("")}</table>` : ""}
</td></tr>
${c.button && url ? `<tr><td style="padding:6px 28px 8px"><a href="${esc(url)}" style="display:inline-block;background:#1d6b4f;color:#ffffff;text-decoration:none;font:600 15px Arial,Helvetica,sans-serif;padding:12px 22px;border-radius:8px">${esc(c.button.label)}</a></td></tr>
<tr><td style="padding:0 28px 8px;font:12px/1.5 Arial,Helvetica,sans-serif;color:#7a6a58">If the button does not work, copy this into your browser:<br><span style="word-break:break-all">${esc(url)}</span></td></tr>` : ""}
${c.footnote ? `<tr><td style="padding:8px 28px 0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#7a6a58">${esc(c.footnote)}</td></tr>` : ""}
<tr><td style="padding:16px 28px 22px;font:12px Arial,Helvetica,sans-serif;color:#7a6a58">${esc(brand)}. Our Family. Our Heritage.</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}
