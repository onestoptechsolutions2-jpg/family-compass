// WhatsApp, the free way: a wa.me link opens WhatsApp with the message already written; a person
// taps Send. No WhatsApp Business API, no cost. Pure: safe in the browser and in tests.

import { OrderStatus } from "@prisma/client";

import { normalisePhone } from "@/lib/referral-rules";

/** Our own WhatsApp, for anyone who needs help (the number in the site footer). */
export const SUPPORT_WHATSAPP = "254113352048";

/** A link that opens WhatsApp to `phone` with `text` ready to send; null if the number is not a Kenyan mobile. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const to = normalisePhone(phone ?? "");
  return to ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : null;
}

/** A link that opens a chat with us, about something in particular. */
export const supportLink = (text: string) => `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;

/** How an order is named in messages: the last 8 characters of its id, as Admin > Orders shows it. */
export const orderRef = (orderId: string) => orderId.slice(-8).toUpperCase();

export type OrderUpdate = {
  orderId: string;
  status: OrderStatus;
  contactName: string | null;
  totalKes: number;
  items: { name: string; progress: string }[];
  /** where the customer follows the order, and pays if they have not yet */
  ordersUrl: string;
  payUrl?: string | null;
  /** the memorial the QR opens, for the family to share */
  memorialUrl?: string | null;
};

/** The message for where the order is now, in the words a customer would use. */
export function orderUpdateMessage(o: OrderUpdate): string {
  const hello = `Hello${o.contactName ? ` ${o.contactName.trim().split(/\s+/)[0]}` : ""}`;
  const ref = orderRef(o.orderId);
  const kes = `KES ${o.totalKes.toLocaleString("en-KE")}`;
  if (o.status === OrderStatus.AWAITING_DEPOSIT) {
    return `${hello}, thank you for your order ${ref} (${o.items.map((i) => i.name).join(", ")}). To start, please pay ${kes} by M-Pesa here: ${o.payUrl ?? o.ordersUrl}`;
  }
  if (o.status === OrderStatus.CANCELLED) {
    return `${hello}, your order ${ref} has been cancelled. If you have any questions, just reply here.`;
  }
  const lines = o.items.map((i) => `• ${i.name}: ${i.progress}`).join("\n");
  const allDelivered = o.items.length > 0 && o.items.every((i) => i.progress === "Delivered");
  return [
    allDelivered
      ? `${hello}, your order ${ref} has been delivered. Thank you for choosing Family Compass 🙏`
      : `${hello}, an update on your order ${ref}:`,
    allDelivered ? null : lines,
    o.memorialUrl ? `Their memorial page, to share with family: ${o.memorialUrl}` : null,
    `Follow your order here: ${o.ordersUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
