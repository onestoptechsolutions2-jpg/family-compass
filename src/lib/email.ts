import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { env, hasEmailProvider } from "@/lib/env";
import { renderEmail, type EmailContent } from "@/lib/email-template";

let transport: Transporter | null = null;

export type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Send one email and say why if it did not go. For the admin's test button, where "false" is not
 * enough. Never throws.
 */
export async function sendEmailChecked(input: Mail): Promise<{ ok: boolean; error?: string }> {
  if (!hasEmailProvider) return { ok: false, error: "Email is not set up: EMAIL_SERVER and EMAIL_FROM are empty." };
  if (!input.to) return { ok: false, error: "There is no address to send to." };
  try {
    transport ??= nodemailer.createTransport(env.EMAIL_SERVER);
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject.slice(0, 200),
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed", err);
    // the reason, without the password that is inside the connection string
    const msg = err instanceof Error ? err.message : "The mail server refused the message.";
    return { ok: false, error: msg.replace(/\/\/[^@\s]*@/g, "//***@").slice(0, 300) };
  }
}

/**
 * Send one email. Returns whether it was sent. Never throws: a mail problem must not break an
 * order. Does nothing until EMAIL_SERVER and EMAIL_FROM are set (the notification still appears in the app).
 */
export async function sendEmail(input: Mail): Promise<boolean> {
  return (await sendEmailChecked(input)).ok;
}

/** A branded message: formatted for people, plain text for everything else. */
export async function sendBranded(to: string, subject: string, content: EmailContent): Promise<boolean> {
  const { text, html } = renderEmail(content);
  return sendEmail({ to, subject, text, html });
}
