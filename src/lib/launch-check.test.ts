import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: {}, hasEmailProvider: false, hasGoogleOAuth: false }));
vi.mock("@/lib/payments", () => ({}));
vi.mock("@/lib/jobs", () => ({ skillLabel: (k: string) => k }));

import { evaluate, type LaunchState } from "./launch-check";

const ready = (): LaunchState => ({
  appUrl: "https://myroots.laitor.co.ke",
  openSignup: true,
  shopSignup: false,
  googleConfigured: true,
  emailConfigured: true,
  adminCount: 1,
  payment: { paybill: true, till: false, bank: false, instructions: true },
  receivingAddress: true,
  products: [
    { name: "Plaque", active: true, priceKes: 30000, skills: ["tile_printing"], shipVia: "direct", priceReviewed: true },
    { name: "Tree", active: true, priceKes: 60000, skills: ["stone_engraving"], shipVia: "via_us", priceReviewed: true },
    { name: "Hidden", active: false, priceKes: 1, skills: ["apparel"], shipVia: "direct", priceReviewed: false },
  ],
  partnerSkills: ["tile_printing", "stone_engraving"],
  ordersPlaced: 3,
});
const failing = (s: LaunchState) => evaluate(s).checks.filter((c) => !c.ok).map((c) => c.id);

describe("launch check", () => {
  it("says yes when everything a customer needs is in place", () => {
    const v = evaluate(ready());
    expect(v.readyForCustomers).toBe(true);
    expect(v.readyForTestOrder).toBe(true);
    expect(failing(ready())).toEqual([]);
  });

  it("the state of your live site today: nobody can sign in, prices are guesses, no partners", () => {
    const s: LaunchState = {
      ...ready(),
      openSignup: false,
      shopSignup: false,
      googleConfigured: false,
      emailConfigured: false,
      receivingAddress: false,
      partnerSkills: [],
      ordersPlaced: 0,
      products: ready().products.map((p) => ({ ...p, priceReviewed: false })),
    };
    const v = evaluate(s);
    expect(v.readyForCustomers).toBe(false);
    expect(failing(s)).toEqual(expect.arrayContaining(["sign-in", "prices-reviewed", "partners", "receiving-address", "email", "first-order"]));
    // but you can still place a test order yourself as an admin
    expect(v.readyForTestOrder).toBe(true);
  });

  it("customers can sign in when they can create their own account", () => {
    expect(failing({ ...ready(), shopSignup: true, openSignup: false, googleConfigured: false })).not.toContain("sign-in");
  });

  it("otherwise sign-up must be open AND Google set up", () => {
    expect(failing({ ...ready(), shopSignup: false, openSignup: false })).toContain("sign-in");
    expect(failing({ ...ready(), shopSignup: false, googleConfigured: false })).toContain("sign-in");
    expect(failing({ ...ready(), shopSignup: false })).not.toContain("sign-in");
  });

  it("a test order needs payment details, an admin and a product on sale, and nothing else", () => {
    expect(evaluate({ ...ready(), payment: { paybill: false, till: false, bank: false, instructions: true } }).readyForTestOrder).toBe(false);
    expect(evaluate({ ...ready(), adminCount: 0 }).readyForTestOrder).toBe(false);
    expect(evaluate({ ...ready(), products: [] }).readyForTestOrder).toBe(false);
    expect(evaluate({ ...ready(), openSignup: false, googleConfigured: false, partnerSkills: [] }).readyForTestOrder).toBe(true);
  });

  it("any one payment method is enough", () => {
    for (const payment of [{ paybill: false, till: true, bank: false }, { paybill: false, till: false, bank: true }]) {
      expect(failing({ ...ready(), payment: { ...payment, instructions: false } })).not.toContain("payment-details");
    }
  });

  it("a QR printed with a local or insecure address is caught", () => {
    for (const appUrl of ["http://localhost:3000", "http://myroots.laitor.co.ke", "https://localhost", "https://127.0.0.1", "not a url"]) {
      expect(failing({ ...ready(), appUrl }), appUrl).toContain("public-address");
    }
  });

  it("names the product still at a guessed price, and only for products on sale", () => {
    const s = ready();
    s.products[0]!.priceReviewed = false;
    const c = evaluate(s).checks.find((x) => x.id === "prices-reviewed")!;
    expect(c.ok).toBe(false);
    expect(c.detail).toContain("Plaque (KES 30,000)");
    expect(c.detail).not.toContain("Hidden");
  });

  it("finds a speciality nobody can do, only among products on sale", () => {
    const s = ready();
    s.partnerSkills = ["tile_printing"];
    const c = evaluate(s).checks.find((x) => x.id === "partners")!;
    expect(c.ok).toBe(false);
    expect(c.detail).toContain("stone_engraving");
    expect(c.detail).not.toContain("apparel"); // that product is switched off
  });

  it("needs a receiving address only when a product on sale comes to you first", () => {
    const s = ready();
    s.receivingAddress = false;
    expect(failing(s)).toContain("receiving-address");
    s.products = s.products.filter((p) => p.shipVia === "direct");
    expect(failing(s)).not.toContain("receiving-address");
  });

  it("nothing on sale is never ready for customers", () => {
    const v = evaluate({ ...ready(), products: ready().products.map((p) => ({ ...p, active: false })) });
    expect(v.readyForCustomers).toBe(false);
    expect(v.checks.find((c) => c.id === "prices-reviewed")!.ok).toBe(false);
  });
});
