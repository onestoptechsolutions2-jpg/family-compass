// Server code (the app and the worker). Not "server-only": that package refuses to load in the
// worker. The token is safe anyway: only NEXT_PUBLIC_ settings ever reach a browser.

import { env } from "@/lib/env";
import type { ChamaPayout } from "@/lib/chama-partner-rules";

/**
 * Client for Chama's partner API: funeral funds run on Chama's M-Pesa wallets, where
 * gifts record themselves. Contract: Chama docs/api.md, "Partner API — funeral funds".
 *
 * Off unless CHAMA_PARTNER_URL and CHAMA_PARTNER_TOKEN are set. Even when on, Chama answers
 * 503 while its wallets are switched off; callers then keep the fund on the family's own
 * M-Pesa, confirmed by hand. Nothing here throws: a Chama outage never breaks an order.
 */
export function partnerEnabled(): boolean {
  return Boolean(env.CHAMA_PARTNER_URL && env.CHAMA_PARTNER_TOKEN);
}

type Json = Record<string, unknown>;
export type PartnerResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; unavailable: boolean };

const TIMEOUT_MS = 10_000;

async function call<T>(method: "GET" | "POST", path: string, body?: Json): Promise<PartnerResult<T>> {
  if (!partnerEnabled()) return { ok: false, status: 0, error: "Chama partner API is not configured", unavailable: true };
  try {
    const res = await fetch(`${env.CHAMA_PARTNER_URL.replace(/\/$/, "")}/api/partner/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.CHAMA_PARTNER_TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as Json;
    if (res.ok) return { ok: true, data: data as T };
    // 503: wallets are off on Chama's side; anything 5xx or a dropped connection: try again later
    return { ok: false, status: res.status, error: String(data.error ?? `Chama answered ${res.status}`), unavailable: res.status >= 500 };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "network", unavailable: true };
  }
}

export type PartnerFund = {
  fundId: number;
  ref: string;
  status: "open" | "closed" | "converted";
  closesOn: string;
  giveUrl: string;
  branches: string[];
  /** only on the first create; Chama never shows it again */
  webhookSecret?: string;
  total?: number;
  giftCount?: number;
  byBranch?: { branch: string; total: number; count: number }[];
};

export type CreateFund = {
  ref: string;
  deceasedName: string;
  name?: string;
  targetKes?: number | null;
  committee: { name: string; phone: string; role: "chair" | "treasurer" | "secretary" }[];
  branches?: string[];
  payout?: ChamaPayout;
  webhookUrl?: string;
};

/** Create a funeral fund. Idempotent on `ref`: the same memorial always gets the same fund. */
export function createFund(input: CreateFund): Promise<PartnerResult<PartnerFund>> {
  const { targetKes, ...rest } = input;
  return call<PartnerFund>("POST", "/funds", { ...rest, ...(targetKes ? { targetKes } : {}) });
}

/** Live totals, by branch, for the committee. */
export function getFund(fundId: number): Promise<PartnerResult<PartnerFund>> {
  return call<PartnerFund>("GET", `/funds/${fundId}`);
}

/**
 * A new signing secret for a fund's webhooks, for when the first one was lost (a timeout after
 * Chama created the fund; the retry comes back without it). The old secret stops working at once.
 */
export function newWebhookSecret(fundId: number): Promise<PartnerResult<{ webhookSecret: string }>> {
  return call("POST", `/funds/${fundId}/webhook-secret`);
}

/** After the burial: keep the committee going as a family welfare chama, inviting these relatives. */
export function convertFund(
  fundId: number,
  members: { name: string; phone: string }[],
): Promise<PartnerResult<{ groupId: number; status: string; invites: { phone: string; invited: boolean; reason?: string }[] }>> {
  return call("POST", `/funds/${fundId}/convert`, { members });
}
