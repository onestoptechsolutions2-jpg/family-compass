import { describe, expect, it } from "vitest";

import { branchesFor, describeChamaPayout, readTotals, toChamaPayout } from "./chama-partner-rules";

describe("payout accounts in Chama's shape", () => {
  it("maps each way a family collects", () => {
    expect(toChamaPayout({ payKind: "PHONE", payNumber: "254712345678", payAccount: null, payName: "Jane" })).toEqual({ kind: "mpesa", phone: "254712345678", name: "Jane" });
    expect(toChamaPayout({ payKind: "PAYBILL", payNumber: "123456", payAccount: "MUSUNGU", payName: "Jane" })).toEqual({ kind: "paybill", paybill: "123456", accountRef: "MUSUNGU", name: "Jane" });
    expect(toChamaPayout({ payKind: "TILL", payNumber: "765432", payAccount: null, payName: "Jane" })).toEqual({ kind: "till", till: "765432", name: "Jane" });
  });
  it("reads a referring group's account back for the admin", () => {
    expect(describeChamaPayout({ kind: "paybill", paybill: "222111", accountRef: "UPENDO", name: "Upendo Welfare" })).toBe("Paybill 222111, account UPENDO (Upendo Welfare)");
    expect(describeChamaPayout(null)).toBeNull();
    expect(describeChamaPayout({ kind: "cash" })).toBeNull();
  });
});

describe("totals Chama reports", () => {
  it("keeps whole shillings and drops anything malformed", () => {
    const t = readTotals({ total: 1500, giftCount: 2, byBranch: [{ branch: "Willy's household", total: 1000, count: 1 }, { branch: 5, total: 1, count: 1 }, { branch: "x", total: -1, count: 1 }] });
    expect(t).toEqual({ total: 1500, giftCount: 2, byBranch: [{ branch: "Willy's household", total: 1000, count: 1 }] });
    expect(readTotals({ total: "1500" }).total).toBeNull();
  });
});

describe("family branches", () => {
  it("names the spouse's side and each child's household", () => {
    expect(branchesFor({ spouse: "Rose Musungu", children: "Willy Okusimba\nJane Okusimba\nWilly Otieno" })).toEqual(["Rose Musungu's side", "Willy Okusimba's household", "Jane Okusimba's household", "Willy Otieno's household"]);
    expect(branchesFor({})).toEqual([]);
  });
});
