import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  stkQuery: vi.fn(),
  fulfilPayment: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { payment: { findUnique: m.findUnique, findMany: m.findMany, updateMany: m.updateMany } } }));
vi.mock("@/lib/payments/daraja", () => ({ stkQuery: m.stkQuery }));
vi.mock("@/lib/payments/fulfil", () => ({ fulfilPayment: m.fulfilPayment }));

import { reconcileStkPayments, settleStk, STK_GRACE_MS } from "./reconcile";

beforeEach(() => vi.clearAllMocks());

describe("settling an M-Pesa prompt whose callback never came", () => {
  it("fulfils a payment M-Pesa says went through", async () => {
    m.findUnique.mockResolvedValue({ status: "AWAITING_STK", checkoutRequestId: "ws_1" });
    m.stkQuery.mockResolvedValue({ pending: false, resultCode: 0, resultDesc: "ok" });
    expect(await settleStk("p1")).toBe("paid");
    expect(m.fulfilPayment).toHaveBeenCalledWith("p1", { note: "M-Pesa STK (query)" });
  });
  it("records a cancelled prompt, but only while it is still waiting on that prompt", async () => {
    m.findUnique.mockResolvedValue({ status: "AWAITING_STK", checkoutRequestId: "ws_1" });
    m.stkQuery.mockResolvedValue({ pending: false, resultCode: 1032, resultDesc: "Request cancelled by user" });
    expect(await settleStk("p1")).toBe("failed");
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", status: "AWAITING_STK", checkoutRequestId: "ws_1" } }));
    expect(m.fulfilPayment).not.toHaveBeenCalled();
  });
  it("leaves a prompt M-Pesa is still processing", async () => {
    m.findUnique.mockResolvedValue({ status: "AWAITING_STK", checkoutRequestId: "ws_1" });
    m.stkQuery.mockResolvedValue({ pending: true, resultCode: null, resultDesc: "processing" });
    expect(await settleStk("p1")).toBe("pending");
    expect(m.updateMany).not.toHaveBeenCalled();
  });
  it("never asks M-Pesa about a payment already paid or not on a prompt", async () => {
    m.findUnique.mockResolvedValueOnce({ status: "PAID", checkoutRequestId: "ws_1" });
    expect(await settleStk("p1")).toBe("paid");
    m.findUnique.mockResolvedValueOnce({ status: "AWAITING_VERIFICATION", checkoutRequestId: "ws_1" });
    expect(await settleStk("p1")).toBe("pending");
    expect(m.stkQuery).not.toHaveBeenCalled();
  });
});

describe("the sweep", () => {
  it("checks prompts past their grace period, and one failure does not stop the rest", async () => {
    const now = new Date("2026-10-27T10:00:00Z");
    m.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    m.findUnique.mockResolvedValue({ status: "AWAITING_STK", checkoutRequestId: "ws" });
    m.stkQuery.mockRejectedValueOnce(new Error("Daraja down")).mockResolvedValueOnce({ pending: false, resultCode: 0, resultDesc: "ok" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reconcileStkPayments(now)).toEqual({ checked: 2, paid: 1, failed: 0 });
    const where = m.findMany.mock.calls[0]![0].where;
    expect(where.updatedAt.lt).toEqual(new Date(now.getTime() - STK_GRACE_MS));
  });
});
