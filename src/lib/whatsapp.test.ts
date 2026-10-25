import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";

import { orderRef, orderUpdateMessage, supportLink, waLink } from "./whatsapp";

const base = {
  orderId: "cmvmtyhlp00127dbi4n0s8d54",
  contactName: "Jane Okusimba",
  totalKes: 9500,
  items: [{ name: "Funeral programme", progress: "Being made" }],
  ordersUrl: "https://fc.test/orders",
};

describe("WhatsApp links", () => {
  it("opens a chat with the message written, for a Kenyan mobile only", () => {
    expect(waLink("0712 345 678", "Hi there")).toBe("https://wa.me/254712345678?text=Hi%20there");
    expect(waLink("12345", "Hi")).toBeNull();
    expect(waLink(null, "Hi")).toBeNull();
    expect(supportLink("Help")).toMatch(/^https:\/\/wa\.me\/254\d{9}\?text=Help$/);
  });
});

describe("order updates", () => {
  it("asks for payment, with the amount and the link", () => {
    const m = orderUpdateMessage({ ...base, status: OrderStatus.AWAITING_DEPOSIT, payUrl: "https://fc.test/pay/1" });
    expect(m).toContain("Hello Jane,");
    expect(m).toContain(orderRef(base.orderId));
    expect(m).toContain("KES 9,500");
    expect(m).toContain("https://fc.test/pay/1");
  });
  it("lists where each piece is, and shares the memorial", () => {
    const m = orderUpdateMessage({ ...base, status: OrderStatus.IN_PRODUCTION, memorialUrl: "https://fc.test/q/abc" });
    expect(m).toContain("• Funeral programme: Being made");
    expect(m).toContain("https://fc.test/q/abc");
    expect(m).toContain("https://fc.test/orders");
  });
  it("thanks the family once everything has arrived", () => {
    const m = orderUpdateMessage({ ...base, status: OrderStatus.DELIVERED, items: [{ name: "Funeral programme", progress: "Delivered" }] });
    expect(m).toContain("has been delivered");
    expect(m).not.toContain("•");
  });
  it("says so when cancelled", () => {
    expect(orderUpdateMessage({ ...base, status: OrderStatus.CANCELLED })).toContain("cancelled");
  });
});
