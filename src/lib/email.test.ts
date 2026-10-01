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

  it("says why it failed, without showing the password in the connection string", async () => {
    vi.doMock("@/lib/env", () => ({ env: { EMAIL_SERVER: "smtp://u:p@mail:587", EMAIL_FROM: "a@b.c" }, hasEmailProvider: true }));
    const { sendEmailChecked } = await import("./email");
    sendMail.mockRejectedValue(new Error("connect ECONNREFUSED smtp://shop:hunter2@mail.example.com:587"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await sendEmailChecked({ to: "ann@example.com", subject: "s", text: "t" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ECONNREFUSED");
    expect(r.error).not.toContain("hunter2");
  });

  it("says email is not set up, rather than just failing", async () => {
    vi.doMock("@/lib/env", () => ({ env: { EMAIL_SERVER: "", EMAIL_FROM: "" }, hasEmailProvider: false }));
    const { sendEmailChecked } = await import("./email");
    const r = await sendEmailChecked({ to: "a@b.com", subject: "s", text: "t" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not set up/i);
  });

  it("sends the formatted version alongside the plain one", async () => {
    vi.doMock("@/lib/env", () => ({ env: { EMAIL_SERVER: "smtp://x", EMAIL_FROM: "a@b.c" }, hasEmailProvider: true }));
    const { sendBranded } = await import("./email");
    sendMail.mockResolvedValue({});
    expect(await sendBranded("ann@example.com", "Hi", { heading: "Hi", paragraphs: ["Body"] })).toBe(true);
    const arg = sendMail.mock.calls[0]![0];
    expect(arg.text).toContain("Body");
    expect(arg.html).toContain("<h1");
  });
});
