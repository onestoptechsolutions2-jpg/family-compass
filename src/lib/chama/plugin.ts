import { env } from "@/lib/env";

/**
 * Chama plugin manifest.
 *
 * Family Compass and the Chama platform (chama.laitor.co.ke) are **separate,
 * independent applications**. This plugin is the whole surface of contact:
 * everything chama-related is gated behind `chamaEnabled()` and can be removed
 * with one env var (`CHAMA_ENABLED=false`).
 *
 * What is actually integrated — only the shared concerns, nothing more:
 *
 *  • Payments      — a memorial can run a welfare fund. Collection reuses
 *                    Family Compass's own PaymentProvider (manual M-Pesa Till
 *                    / Daraja STK). When a tree is linked to a real Chama
 *                    group, confirmed contributions are mirrored there via the
 *                    group's Developer API (`POST /api/v1/contributions`).
 *  • Communication — the group's outbound webhooks (HMAC-signed) are accepted
 *                    at /api/webhooks/chama/[treeId] and surface as in-app
 *                    notifications + the `chama.external_event` webhook.
 *  • Read models   — group metadata, members, capital position and recent
 *                    contributions are read for display on Tree → Chama.
 *
 * What is deliberately NOT reimplemented here (stays on the Chama platform):
 * loans, fines, merry-go-round rotations, table banking, meetings, member
 * dashboards, group governance.
 *
 * Code that belongs to the plugin:
 *   src/lib/chama.ts                       local welfare-fund ledger
 *   src/lib/chama-api.ts                   external group API v1 client
 *   src/lib/chama/plugin.ts                this manifest / feature gate
 *   src/app/(app)/trees/[treeId]/chama/**  link + read UI
 *   src/app/give/[token]/**                public contribution page
 *   src/app/api/webhooks/chama/**          inbound webhook
 *   prisma: Chama, ChamaMember, ChamaFund, ChamaContribution, ChamaLink
 */
export function chamaEnabled(): boolean {
  return env.CHAMA_ENABLED;
}

export const CHAMA_PLUGIN = {
  id: "chama",
  name: "Chama — family welfare & savings",
  integrates: ["payments", "communication"] as const,
  externalApp: "https://chama.laitor.co.ke",
  disableWith: "CHAMA_ENABLED=false",
} as const;
