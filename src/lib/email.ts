import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { env, hasEmailProvider } from "@/lib/env";

let transport: Transporter | null = null;

/**
 * Send one plain-text email. Returns whether it was sent. Never throws: a mail
 * problem must not break an order. Does nothing until EMAIL_SERVER and
 * EMAIL_FROM are set (the notification still appears in the app).
 */
export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!hasEmailProvider || !input.to) return false;
  try {
    transport ??= nodemailer.createTransport(env.EMAIL_SERVER);
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject.slice(0, 200),
      text: input.text,
    });
    return true;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}
