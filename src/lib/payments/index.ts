import type { PaymentProvider } from "./provider";
import { manualMpesaProvider } from "./manual-mpesa";

/**
 * Registry of payment providers. Only `manual_mpesa` is functional today.
 * Aggregator providers (IntaSend / Paystack STK push) implement the same
 * interface and are selected via PaymentSettings.provider.
 */
const REGISTRY: Record<string, PaymentProvider> = {
  manual_mpesa: manualMpesaProvider,
};

export function getProvider(id: string): PaymentProvider {
  return REGISTRY[id] ?? manualMpesaProvider;
}

export { getPaymentSettings } from "./provider";
export type { PaymentSettings, CheckoutInstruction, PaymentProvider } from "./provider";
