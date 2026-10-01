import { describe, expect, it } from "vitest";

import { renderEmail } from "./email-template";

describe("renderEmail", () => {
  const base = {
    heading: "We received your order",
    paragraphs: ["Hello Ann,", "Pay KES 20,500 by M-Pesa."],
    items: ["Wooden family tree x 1: KES 20,500", "Total: KES 20,500"],
    button: { label: "Pay now", url: "https://myroots.laitor.co.ke/pay/abc" },
    footnote: "Delivery is included.",
  };

  it("makes a plain-text version with everything in it", () => {
    const { text } = renderEmail(base);
    for (const s of ["We received your order", "Hello Ann,", "Pay KES 20,500 by M-Pesa.", "Wooden family tree x 1: KES 20,500", "Pay now: https://myroots.laitor.co.ke/pay/abc", "Delivery is included.", "Family Compass"]) {
      expect(text).toContain(s);
    }
  });

  it("makes an html version with a button that goes to the link", () => {
    const { html } = renderEmail(base);
    expect(html).toContain('href="https://myroots.laitor.co.ke/pay/abc"');
    expect(html).toContain("Pay now");
    expect(html).toContain("Wooden family tree x 1: KES 20,500");
  });

  it("never lets a customer's words become markup", () => {
    const { html, text } = renderEmail({ heading: "<script>alert(1)</script>", paragraphs: ['Ann "<b>Kamau</b>" & sons'], items: ["<img src=x onerror=alert(1)>"] });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; sons");
    expect(text).toContain("<script>alert(1)</script>"); // plain text is plain
  });

  it("drops a button whose link is not a web address", () => {
    const { html, text } = renderEmail({ heading: "x", paragraphs: [], button: { label: "Click", url: "javascript:alert(1)" } });
    expect(html).not.toContain("javascript:");
    expect(text).not.toContain("javascript:");
  });

  it("works with only a heading", () => {
    const { text, html } = renderEmail({ heading: "Hello", paragraphs: [] });
    expect(text.startsWith("Hello")).toBe(true);
    expect(html).toContain("<h1");
  });
});
