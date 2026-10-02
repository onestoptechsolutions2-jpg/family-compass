import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getPaymentSettings: vi.fn(),
  getProvider: vi.fn(),
  fulfilPayment: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentUpdate: vi.fn(),
}));

vi.mock("@/lib/payments", () => ({
  getPaymentSettings: mocks.getPaymentSettings,
  getProvider: mocks.getProvider,
}));

vi.mock("@/lib/payments/fulfil", () => ({ fulfilPayment: mocks.fulfilPayment }));

vi.mock("@/lib/payments/daraja", () => ({
  DARAJA_PROVIDER_ID: "mpesa_daraja",
  parseStkCallback: (raw: string) => {
    try {
      const callback = (JSON.parse(raw) as { Body?: { stkCallback?: Record<string, unknown> } }).Body?.stkCallback;
      if (!callback) return null;
      const metadata = (callback.CallbackMetadata as { Item?: { Name: string; Value: unknown }[] } | undefined)?.Item ?? [];
      const value = (name: string) => metadata.find((item) => item.Name === name)?.Value;
      return {
        checkoutRequestId: String(callback.CheckoutRequestID ?? ""),
        merchantRequestId: String(callback.MerchantRequestID ?? ""),
        resultCode: Number(callback.ResultCode ?? -1),
        resultDesc: String(callback.ResultDesc ?? ""),
        receipt: value("MpesaReceiptNumber") ? String(value("MpesaReceiptNumber")) : undefined,
      };
    } catch {
      return null;
    }
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    payment: {
      findFirst: mocks.paymentFindFirst,
      findUnique: mocks.paymentFindUnique,
      update: mocks.paymentUpdate,
    },
  },
}));

import { POST } from "./[provider]/route";

function request(body = "", headers?: HeadersInit) {
  return new Request("http://localhost/api/payments/webhook/provider", {
    method: "POST",
    body,
    headers,
  }) as unknown as NextRequest;
}

function params(provider: string) {
  return { params: Promise.resolve({ provider }) };
}

describe("payment webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPaymentSettings.mockResolvedValue({ provider: "mpesa_daraja" });
    mocks.fulfilPayment.mockResolvedValue({ ok: true });
  });

  it("ignores callbacks for an inactive provider", async () => {
    mocks.getPaymentSettings.mockResolvedValue({ provider: "manual_mpesa" });

    const response = await POST(request(), params("mpesa_daraja"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ResultCode: 0, ResultDesc: "ignored" });
    expect(mocks.paymentFindFirst).not.toHaveBeenCalled();
  });

  it("acknowledges malformed Daraja callbacks without touching payments", async () => {
    const response = await POST(request("not-json"), params("mpesa_daraja"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ResultCode: 0, ResultDesc: "unparseable" });
    expect(mocks.paymentFindFirst).not.toHaveBeenCalled();
  });

  it("fulfils a successful Daraja callback", async () => {
    mocks.paymentFindFirst.mockResolvedValue({ id: "pay_1", status: "AWAITING_STK" });
    const body = JSON.stringify({
      Body: {
        stkCallback: {
          CheckoutRequestID: "ws_CO_1",
          MerchantRequestID: "ws_MR_1",
          ResultCode: 0,
          ResultDesc: "Success",
          CallbackMetadata: { Item: [{ Name: "MpesaReceiptNumber", Value: "QAB123" }] },
        },
      },
    });

    const response = await POST(request(body), params("mpesa_daraja"));

    expect(response.status).toBe(200);
    expect(mocks.fulfilPayment).toHaveBeenCalledWith("pay_1", {
      note: "M-Pesa STK",
      providerRef: "QAB123",
      receivedKes: null,
    });
    expect(mocks.paymentUpdate).not.toHaveBeenCalled();
  });

  it("rejects an unsuccessful Daraja callback when payment is still open", async () => {
    mocks.paymentFindFirst.mockResolvedValue({ id: "pay_2", status: "AWAITING_STK" });
    const body = JSON.stringify({
      Body: {
        stkCallback: {
          CheckoutRequestID: "ws_CO_2",
          ResultCode: 1032,
          ResultDesc: "Request cancelled by user",
        },
      },
    });

    await POST(request(body), params("mpesa_daraja"));

    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: "pay_2" },
      data: {
        status: "REJECTED",
        resultCode: 1032,
        resultDesc: "Request cancelled by user",
        rejectionReason: "Request cancelled by user",
      },
    });
    expect(mocks.fulfilPayment).not.toHaveBeenCalled();
  });

  it("verifies and fulfils a generic provider webhook", async () => {
    mocks.getPaymentSettings.mockResolvedValue({ provider: "acme" });
    const verifyWebhook = vi.fn().mockResolvedValue({ ok: true, reference: "FC-123" });
    mocks.getProvider.mockReturnValue({ verifyWebhook });
    mocks.paymentFindUnique.mockResolvedValue({ id: "pay_3" });

    const response = await POST(request('{"reference":"FC-123"}', { "x-signature": "valid" }), params("acme"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(verifyWebhook).toHaveBeenCalledOnce();
    expect(mocks.fulfilPayment).toHaveBeenCalledWith("pay_3", { note: "webhook:acme" });
  });
});