// Where contributors to a family fund send their money. Pure: no database, safe in the browser.
//
// The money always goes straight to the family: their own phone, paybill or till. Family
// Compass shows the number and records what people say they sent; it never holds the money.

import { normalisePhone } from "@/lib/referral-rules";

export type PayKind = "PHONE" | "PAYBILL" | "TILL";
export type FundDestination = { payKind: PayKind; payNumber: string; payAccount: string | null; payName: string };

export const PAY_KINDS: [PayKind, string][] = [
  ["PHONE", "An M-Pesa phone number (Send Money)"],
  ["PAYBILL", "A paybill and account number"],
  ["TILL", "A till number (Buy Goods)"],
];

const isKind = (v: string): v is PayKind => v === "PHONE" || v === "PAYBILL" || v === "TILL";

/**
 * Check what the family typed. Returns the destination, or the first problem in plain words.
 * Nothing typed at all is not an error: the caller decides whether a destination is required.
 */
export function parseDestination(raw: {
  payKind?: string | null;
  payNumber?: string | null;
  payAccount?: string | null;
  payName?: string | null;
}): { ok: true; value: FundDestination } | { ok: false; error: string } | { ok: true; value: null } {
  const kind = String(raw.payKind ?? "").trim().toUpperCase();
  const number = String(raw.payNumber ?? "").replace(/\s+/g, "");
  const account = String(raw.payAccount ?? "").trim().slice(0, 40);
  const name = String(raw.payName ?? "").trim().slice(0, 80);
  if (!number && !account && !name) return { ok: true, value: null };
  if (!isKind(kind)) return { ok: false, error: "Choose how people send money: a phone number, a paybill or a till." };
  if (!name) return { ok: false, error: "Add the name M-Pesa shows for that number, so people can check before they send." };
  if (kind === "PHONE") {
    const phone = normalisePhone(number);
    if (!phone) return { ok: false, error: "That does not look like a Kenyan mobile number, e.g. 0712 345 678." };
    return { ok: true, value: { payKind: kind, payNumber: phone, payAccount: null, payName: name } };
  }
  if (!/^\d{5,7}$/.test(number)) return { ok: false, error: `A ${kind === "PAYBILL" ? "paybill" : "till"} number is 5 to 7 digits.` };
  if (kind === "PAYBILL" && !account) return { ok: false, error: "Add the account number people should use with the paybill." };
  return { ok: true, value: { payKind: kind, payNumber: number, payAccount: kind === "PAYBILL" ? account : null, payName: name } };
}

/** A phone number as people read it: 254712345678 → 0712 345 678. */
export const localPhone = (p: string) => {
  const local = `0${p.replace(/^254/, "")}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
};

/** One line for a page or a programme: where to send, and the name M-Pesa will show. */
export function describeDestination(d: { payKind: string | null; payNumber: string | null; payAccount: string | null; payName: string | null }): string | null {
  if (!d.payKind || !d.payNumber) return null;
  const who = d.payName ? ` (${d.payName})` : "";
  if (d.payKind === "PHONE") return `M-Pesa ${localPhone(d.payNumber)}${who}`;
  if (d.payKind === "PAYBILL") return `Paybill ${d.payNumber}, account ${d.payAccount ?? ""}${who}`;
  if (d.payKind === "TILL") return `Till (Buy Goods) ${d.payNumber}${who}`;
  return null;
}
