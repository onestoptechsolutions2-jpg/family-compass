import { env, hasDaraja } from "@/lib/env";
import type { CheckoutInstruction, PaymentProvider } from "./provider";

/**
 * Safaricom Daraja — M-Pesa Express (STK Push). Dormant until the MPESA_*
 * env vars are set AND PaymentSettings.provider is "mpesa_daraja".
 * No aggregator; talks to Safaricom directly.
 */
const HOST = () =>
  env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

export const DARAJA_PROVIDER_ID = "mpesa_daraja";
export { hasDaraja as darajaConfigured };

// ---- OAuth token (cached ~55 min) ----
let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const auth = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${HOST()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const j = (await res.json()) as { access_token?: string; expires_in?: string };
  if (!j.access_token) throw new Error("Daraja auth: no token");
  tokenCache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 3599) - 60) * 1000 };
  return j.access_token;
}

function stamp(): { timestamp: string; password: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const password = Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`).toString("base64");
  return { timestamp, password };
}

/** Normalise a Kenyan number to 2547XXXXXXXX / 2541XXXXXXXX (no +). */
export function mpesaMsisdn(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (/^254(7|1)\d{8}$/.test(d)) return d;
  if (/^0(7|1)\d{8}$/.test(d)) return `254${d.slice(1)}`;
  if (/^(7|1)\d{8}$/.test(d)) return `254${d}`;
  return null;
}

export type StkResult = {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  customerMessage: string;
};

export async function stkPush(input: {
  amountKes: number;
  phone: string;
  reference: string;
  description: string;
  callbackUrl: string;
}): Promise<StkResult> {
  if (!hasDaraja) throw new Error("M-Pesa STK is not configured on this server");
  const msisdn = mpesaMsisdn(input.phone);
  if (!msisdn) throw new Error("Enter a valid Safaricom number (07… or 2547…)");

  const { timestamp, password } = stamp();
  const res = await fetch(`${HOST()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: env.MPESA_TRANSACTION_TYPE,
      Amount: Math.max(1, Math.round(input.amountKes)),
      PartyA: msisdn,
      PartyB: env.MPESA_SHORTCODE,
      PhoneNumber: msisdn,
      CallBackURL: input.callbackUrl,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 60),
    }),
    cache: "no-store",
  });
  const j = (await res.json()) as Record<string, string>;
  if (!res.ok || j.ResponseCode !== "0") {
    throw new Error(j.errorMessage || j.ResponseDescription || `STK push failed (${res.status})`);
  }
  return {
    checkoutRequestId: j.CheckoutRequestID!,
    merchantRequestId: j.MerchantRequestID!,
    responseCode: j.ResponseCode,
    customerMessage: j.CustomerMessage ?? "Check your phone to complete the payment.",
  };
}

export type StkQuery = { resultCode: number | null; resultDesc: string; pending: boolean };

export async function stkQuery(checkoutRequestId: string): Promise<StkQuery> {
  if (!hasDaraja) return { resultCode: null, resultDesc: "not configured", pending: true };
  const { timestamp, password } = stamp();
  const res = await fetch(`${HOST()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    cache: "no-store",
  });
  const j = (await res.json()) as Record<string, string>;
  // "processing" → ResultCode absent / errorCode 500.001.1001
  if (j.ResultCode === undefined) {
    return { resultCode: null, resultDesc: j.ResultDesc ?? j.errorMessage ?? "processing", pending: true };
  }
  const code = Number(j.ResultCode);
  return { resultCode: code, resultDesc: j.ResultDesc ?? "", pending: false };
}

export type CallbackParsed = {
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode: number;
  resultDesc: string;
  receipt?: string;
  amount?: number;
  phone?: string;
};

/** Parse a Daraja STK callback body. */
export function parseStkCallback(raw: string): CallbackParsed | null {
  try {
    const stk = (JSON.parse(raw) as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
    if (!stk) return null;
    const meta = ((stk.CallbackMetadata as { Item?: { Name: string; Value: unknown }[] })?.Item ?? []);
    const get = (name: string) => meta.find((m) => m.Name === name)?.Value;
    return {
      checkoutRequestId: String(stk.CheckoutRequestID ?? ""),
      merchantRequestId: String(stk.MerchantRequestID ?? ""),
      resultCode: Number(stk.ResultCode ?? -1),
      resultDesc: String(stk.ResultDesc ?? ""),
      receipt: get("MpesaReceiptNumber") ? String(get("MpesaReceiptNumber")) : undefined,
      amount: get("Amount") != null ? Number(get("Amount")) : undefined,
      phone: get("PhoneNumber") != null ? String(get("PhoneNumber")) : undefined,
    };
  } catch {
    return null;
  }
}

export const darajaProvider: PaymentProvider = {
  id: DARAJA_PROVIDER_ID,
  async checkout({ amountKes, settings }): Promise<CheckoutInstruction> {
    return {
      mode: "stk",
      note: hasDaraja
        ? `Enter your Safaricom number and we'll send an M-Pesa prompt for ${settings.currency} ${amountKes.toLocaleString()}. Approve it with your PIN.`
        : "M-Pesa STK is not configured on this server yet — an admin must set the MPESA_* variables.",
    };
  },
};
