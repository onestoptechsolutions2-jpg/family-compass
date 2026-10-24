import { describe, expect, it } from "vitest";

import { signChama, verifyChamaSignature } from "./chama-signature";

const secret = "s3cret-shared-with-chama";
const body = '{"eventId":"e1","event":"fund.gift.paid","data":{"fundId":15,"amount":1000}}';
const now = 1_793_091_600;

describe("Chama's signature", () => {
  it("accepts a fresh, correctly signed request", () => {
    const ts = String(now - 30);
    expect(verifyChamaSignature(body, ts, signChama(secret, ts, body), secret, now)).toBe(true);
  });
  it("refuses a changed body, a wrong secret or a missing header", () => {
    const ts = String(now);
    const sig = signChama(secret, ts, body);
    expect(verifyChamaSignature(body.replace("1000", "100000"), ts, sig, secret, now)).toBe(false);
    expect(verifyChamaSignature(body, ts, sig, "other", now)).toBe(false);
    expect(verifyChamaSignature(body, null, sig, secret, now)).toBe(false);
    expect(verifyChamaSignature(body, ts, null, secret, now)).toBe(false);
    expect(verifyChamaSignature(body, ts, sig, "", now)).toBe(false);
  });
  it("refuses a replay more than five minutes old, or from the future", () => {
    const old = String(now - 301);
    expect(verifyChamaSignature(body, old, signChama(secret, old, body), secret, now)).toBe(false);
    const ahead = String(now + 301);
    expect(verifyChamaSignature(body, ahead, signChama(secret, ahead, body), secret, now)).toBe(false);
  });
  it("refuses a signature over the body alone (the old header)", () => {
    const ts = String(now);
    const bodyOnly = signChama(secret, "", body).slice(0); // not the same as ts-prefixed
    expect(verifyChamaSignature(body, ts, bodyOnly, secret, now)).toBe(false);
  });
});
