import { describe, expect, it } from "vitest";

import { chooseReferrer, codeStem, commissionKes, normaliseCode, normalisePhone } from "./referral-rules";

describe("referral codes", () => {
  it("reads a code however it is typed", () => {
    expect(normaliseCode(" upendo-123 ")).toBe("UPENDO123");
    expect(normaliseCode("ab")).toBeNull();
    expect(normaliseCode(undefined)).toBeNull();
    expect(normaliseCode("x".repeat(30))).toBeNull();
  });
  it("starts a new code from the name", () => {
    expect(codeStem("Upendo Funeral Home")).toBe("UPENDO");
    expect(codeStem("Mũthoni")).toBe("MTHONI");
    expect(codeStem("7")).toBe("FAMILY");
  });
});

describe("what a referrer earns", () => {
  it("is the share of what was paid, rounded down to the shilling", () => {
    expect(commissionKes(9500, 10)).toBe(950);
    expect(commissionKes(1999, 10)).toBe(199);
  });
  it("is nothing for nothing, and never more than the order", () => {
    expect(commissionKes(0, 10)).toBe(0);
    expect(commissionKes(5000, 0)).toBe(0);
    expect(commissionKes(5000, 500)).toBe(5000);
  });
});

describe("payout numbers", () => {
  it("accepts the ways Kenyans write a mobile number", () => {
    expect(normalisePhone("0712 345 678")).toBe("254712345678");
    expect(normalisePhone("+254 712 345678")).toBe("254712345678");
    expect(normalisePhone("0112345678")).toBe("254112345678");
  });
  it("refuses what is not one", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("0201234567")).toBeNull();
  });
});

describe("who an order is credited to", () => {
  const a = { id: "a", userId: "ua", status: "ACTIVE" };
  const b = { id: "b", userId: "ub", status: "ACTIVE" };
  it("prefers the code the customer typed over the link they opened", () => {
    expect(chooseReferrer(a, b, "customer")?.id).toBe("a");
    expect(chooseReferrer(null, b, "customer")?.id).toBe("b");
  });
  it("never credits a customer for their own order", () => {
    expect(chooseReferrer(a, null, "ua")).toBeNull();
    expect(chooseReferrer(a, b, "ua")?.id).toBe("b");
  });
  it("credits nobody through a paused referrer", () => {
    expect(chooseReferrer({ ...a, status: "SUSPENDED" }, null, "customer")).toBeNull();
  });
});
