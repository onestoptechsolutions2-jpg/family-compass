// Pure shapes for Chama's partner API (funeral funds). No network, no database: tested on their own.
// The contract is Chama's docs/api.md, "Partner API — funeral funds", as merged in Chama 67c3a71.

import type { FundDestination } from "@/lib/fund-destination";

/** Chama's payout account shape. */
export type ChamaPayout =
  | { kind: "mpesa"; phone: string; name: string }
  | { kind: "paybill"; paybill: string; accountRef: string; name: string }
  | { kind: "till"; till: string; name: string }
  | { kind: "bank"; bankCode: string; account: string; name: string };

/** Our record of where a family's money goes, in Chama's shape. */
export function toChamaPayout(d: FundDestination): ChamaPayout {
  if (d.payKind === "PHONE") return { kind: "mpesa", phone: d.payNumber, name: d.payName };
  if (d.payKind === "PAYBILL") return { kind: "paybill", paybill: d.payNumber, accountRef: d.payAccount ?? "", name: d.payName };
  return { kind: "till", till: d.payNumber, name: d.payName };
}

/** A payout Chama sent us (a referring group's account), in one line for the admin. */
export function describeChamaPayout(p: unknown): string | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const name = typeof o.name === "string" && o.name ? ` (${o.name})` : "";
  switch (o.kind) {
    case "mpesa":
      return typeof o.phone === "string" ? `M-Pesa ${o.phone}${name}` : null;
    case "paybill":
      return typeof o.paybill === "string" ? `Paybill ${o.paybill}, account ${String(o.accountRef ?? "")}${name}` : null;
    case "till":
      return typeof o.till === "string" ? `Till ${o.till}${name}` : null;
    case "bank":
      return typeof o.account === "string" ? `Bank ${String(o.bankCode ?? "")} account ${o.account}${name}` : null;
    default:
      return null;
  }
}

export type BranchTotal = { branch: string; total: number; count: number };

/** Totals as Chama reports them, checked: anything malformed becomes nothing rather than a wrong number. */
export function readTotals(data: Record<string, unknown>): { total: number | null; giftCount: number | null; byBranch: BranchTotal[] } {
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
  const byBranch = Array.isArray(data.byBranch)
    ? data.byBranch.flatMap((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        const total = int(o.total);
        const count = int(o.count);
        return typeof o.branch === "string" && total !== null && count !== null ? [{ branch: o.branch.slice(0, 120), total, count }] : [];
      })
    : [];
  return { total: int(data.total), giftCount: int(data.giftCount), byBranch };
}

/**
 * The family branches a funeral fund collects by: the spouse's side and each child's household,
 * named the way families say it ("Willy Okusimba's household"). At most 12, no repeats.
 */
export function branchesFor(o: { spouse?: string; children?: string }): string[] {
  const names = (t?: string) => (t ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // full names, so two children called Willy are still two households
  const out = [...names(o.spouse).slice(0, 1).map((s) => `${s}'s side`), ...names(o.children).map((c) => `${c}'s household`)];
  return [...new Set(out)].slice(0, 12);
}
