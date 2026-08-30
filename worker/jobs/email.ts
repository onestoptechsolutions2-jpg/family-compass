import type { Job } from "pg-boss";
import nodemailer from "nodemailer";

import { env } from "@/lib/env";
import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";

type EmailPayload = JobPayloads[typeof QUEUE.sendEmail];

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (!env.EMAIL_SERVER) return null;
  transport ??= nodemailer.createTransport(env.EMAIL_SERVER);
  return transport;
}

export async function handleSendEmail(jobs: Job<EmailPayload>[]) {
  const t = getTransport();
  for (const job of jobs) {
    const { to, subject, html, text } = job.data;
    if (!t) {
      console.warn(`[email] EMAIL_SERVER not configured — dropping "${subject}" to ${to}`);
      continue;
    }
    await t.sendMail({ from: env.EMAIL_FROM, to, subject, html, text: text ?? undefined });
    console.log(`[email] sent "${subject}" to ${to}`);
  }
}
