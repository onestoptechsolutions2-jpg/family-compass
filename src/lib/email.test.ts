import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));

describe("sendEmail", () => {
  beforeEach(() => {
    sendMail.mockReset();
    vi.resetModules();
  });

  it("does nothing until email is set up", async () => {
    vi.doMock("@/lib/env", () => ({ env: { EMAIL_SERVER: "", EMAIL_FROM: "" }, hasEmailProvider: false }));
    const { sendEmail } = await import("./email");
    expect(await sendEmail({ to: "a@b.com", subject: "Hi", text: "x" })).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends a plain-text message from the configured address", async () => {
    vi.doMock("@/lib/env", () => ({ env: { EMAIL_SERVER: "smtp://u:p@mail:587", EMAIL_FROM: "Family Compass <shop@x.co.ke>" }, hasEmailProvider: true }));
    const { sendEmail } = await import("./email");
    sendMail.mockResolvedValue({});
    expect(await sendEmail({ to: "ann@example.com", subject: "Your order is on its way", text: "Body" })).toBe(true);
    expect(sendMail).toHaveBeenCalledWith({ from: "Family Compass <shop@x.co.ke>", to: "ann@example.com", subject: "Your order is on its way", text: "Body" });
  });

  it("swallows a mail failure so an order is never broken by it", async () => {
    vi.doMock("@/lib/env", () => ({ env: { EMAIL_SERVER: "smtp://u:p@mail:587", EMAIL_FROM: "shop@x.co.ke" }, hasEmailProvider: true }));
    const { sendEmail } = await import("./email");
    sendMail.mockRejectedValue(new Error("smtp down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendEmail({ to: "ann@example.com", subject: "s", text: "t" })).toBe(false);
  });

  it("does not send to an empty address", async () => {
    vi.doMock("@/lib/env", () => ({ env: { EMAIL_SERVER: "smtp://x", EMAIL_FROM: "a@b.c" }, hasEmailProvider: true }));
    const { sendEmail } = await import("./email");
    expect(await sendEmail({ to: "", subject: "s", text: "t" })).toBe(false);
  });
});
