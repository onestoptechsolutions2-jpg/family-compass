import type { PaymentProvider } from "./provider";
import { manualMpesaProvider } from "./manual-mpesa";
import { darajaProvider } from "./daraja";

/**
 * Registry of payment providers, selected via PaymentSettings.provider.
 * - manual_mpesa : pay to a Till, paste the code, admin verifies (default)
 * - mpesa_daraja : Safaricom STK Push (needs MPESA_* env vars)
 */
const REGISTRY: Record<string, PaymentProvider> = {
  manual_mpesa: manualMpesaProvider,
  mpesa_daraja: darajaProvider,
};

export const PAYMENT_PROVIDERS = [
  { id: "manual_mpesa", label: "Manual M-Pesa Till (paste code, admin verifies)" },
  { id: "mpesa_daraja", label: "M-Pesa STK Push via Daraja (needs MPESA_* env)" },
];

export function getProvider(id: string): PaymentProvider {
  return REGISTRY[id] ?? manualMpesaProvider;
}

export { getPaymentSettings, generationBaseKes } from "./provider";
export type { PaymentSettings, CheckoutInstruction, PaymentProvider } from "./provider";
