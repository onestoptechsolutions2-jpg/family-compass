import { describe, expect, it } from "vitest";

import { describeDestination, localPhone, parseDestination } from "./fund-destination";

describe("where a family fund's money goes", () => {
  it("takes a phone number in any common form", () => {
    const r = parseDestination({ payKind: "PHONE", payNumber: "0712 345 678", payName: "Jane Okusimba" });
    expect(r).toEqual({ ok: true, value: { payKind: "PHONE", payNumber: "254712345678", payAccount: null, payName: "Jane Okusimba" } });
  });
  it("needs an account with a paybill, and none with a till", () => {
    expect(parseDestination({ payKind: "PAYBILL", payNumber: "123456", payName: "Musungu Funeral" }).ok).toBe(false);
    const till = parseDestination({ payKind: "TILL", payNumber: "765432", payAccount: "ignored", payName: "Musungu Funeral" });
    expect(till.ok && till.value?.payAccount).toBeNull();
  });
  it("needs the name M-Pesa shows, so people can check before sending", () => {
    expect(parseDestination({ payKind: "PHONE", payNumber: "0712345678" })).toMatchObject({ ok: false });
  });
  it("refuses numbers that cannot be right", () => {
    expect(parseDestination({ payKind: "PHONE", payNumber: "12345", payName: "x" }).ok).toBe(false);
    expect(parseDestination({ payKind: "TILL", payNumber: "12", payName: "x" }).ok).toBe(false);
    expect(parseDestination({ payKind: "CASH", payNumber: "123456", payName: "x" }).ok).toBe(false);
  });
  it("treats nothing typed as no destination, not an error", () => {
    expect(parseDestination({})).toEqual({ ok: true, value: null });
  });
  it("reads back in one line", () => {
    expect(localPhone("254712345678")).toBe("0712 345 678");
    expect(describeDestination({ payKind: "PHONE", payNumber: "254712345678", payAccount: null, payName: "Jane" })).toBe("M-Pesa 0712 345 678 (Jane)");
    expect(describeDestination({ payKind: "PAYBILL", payNumber: "123456", payAccount: "MUSUNGU", payName: "Jane" })).toBe("Paybill 123456, account MUSUNGU (Jane)");
    expect(describeDestination({ payKind: null, payNumber: null, payAccount: null, payName: null })).toBeNull();
  });
});
