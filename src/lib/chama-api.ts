import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Client for an external Chama group's Developer API v1
 * (https://chama.laitor.co.ke, `Authorization: Bearer chama_live_…`).
 * Read-only except POST /contributions. All calls are best-effort — a linked
 * group being down must never break a memorial action.
 */

export type ChamaLinkRow = {
  id: string;
  treeId: string;
  baseUrl: string;
  apiKey: string;
  currency: string;
};

type Json = Record<string, unknown>;

const TIMEOUT_MS = 8000;

async function call(
  link: Pick<ChamaLinkRow, "baseUrl" | "apiKey">,
  method: "GET" | "POST",
  path: string,
  body?: Json,
): Promise<{ ok: boolean; status: number; data: Json }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${link.baseUrl.replace(/\/$/, "")}/api/v1${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${link.apiKey}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Json;
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err instanceof Error ? err.message : "network" } };
  } finally {
    clearTimeout(t);
  }
}

/** Validate a key + capture group metadata. Returns null on failure. */
export async function fetchChamaGroup(
  link: Pick<ChamaLinkRow, "baseUrl" | "apiKey">,
): Promise<{ id: number; name: string; type: string; currency: string; loansEnabled?: boolean } | null> {
  const r = await call(link, "GET", "/group");
  const g = (r.data.group ?? null) as Json | null;
  if (!r.ok || !g) return null;
  return {
    id: Number(g.id),
    name: String(g.name ?? "Chama group"),
    type: String(g.type ?? ""),
    currency: String(g.currency ?? "KES"),
    loansEnabled: Boolean(g.loansEnabled),
  };
}

export async function fetchCapitalPosition(link: Pick<ChamaLinkRow, "baseUrl" | "apiKey">): Promise<Json | null> {
  const r = await call(link, "GET", "/capital-position");
  return r.ok ? ((r.data.position ?? null) as Json | null) : null;
}

export async function fetchRecentContributions(
  link: Pick<ChamaLinkRow, "baseUrl" | "apiKey">,
): Promise<Json[]> {
  const r = await call(link, "GET", "/contributions");
  const list = r.data.contributions;
  return Array.isArray(list) ? (list as Json[]) : [];
}

export async function fetchMembers(link: Pick<ChamaLinkRow, "baseUrl" | "apiKey">): Promise<Json[]> {
  const r = await call(link, "GET", "/members");
  const list = r.data.members;
  return Array.isArray(list) ? (list as Json[]) : [];
}

/**
 * Record an inbound welfare contribution on the linked group. `memberId` is
 * optional on our side — if the group requires one this will 400 and we just
 * log it against the link.
 */
export async function pushWelfareContribution(
  link: ChamaLinkRow & { id: string; treeId: string },
  input: { amount: number; reference?: string; note?: string; memberId?: number },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const r = await call(link, "POST", "/contributions", {
    type: "welfare",
    amount: Math.round(input.amount),
    ...(input.memberId ? { memberId: input.memberId } : {}),
    ...(input.reference ? { reference: input.reference.slice(0, 60) } : {}),
  });
  await db.chamaLink
    .update({
      where: { id: link.id },
      data: r.ok
        ? { lastSyncedAt: new Date(), lastError: null }
        : { lastError: `contributions: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}` },
    })
    .catch(() => {});
  if (!r.ok) return { ok: false, error: String(r.data.error ?? r.status) };
  return { ok: true, id: typeof r.data.id === "number" ? r.data.id : undefined };
}

/** Verify an inbound `X-Chama-Signature` (HMAC-SHA256 hex of the raw body). */
export function verifyChamaWebhook(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHeader, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
