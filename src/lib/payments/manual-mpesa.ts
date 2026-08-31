import type { CheckoutInstruction, PaymentProvider } from "./provider";

export const manualMpesaProvider: PaymentProvider = {
  id: "manual_mpesa",
  async checkout({ reference, amountKes, settings }) {
    const payTo: { label: string; value: string }[] = [];
    if (settings.tillNumber) payTo.push({ label: "M-Pesa Buy Goods (Till)", value: settings.tillNumber });
    if (settings.storeNumber) payTo.push({ label: "Store number", value: settings.storeNumber });
    if (settings.paybillNumber) payTo.push({ label: "M-Pesa Paybill", value: settings.paybillNumber });
    if (settings.accountRef) payTo.push({ label: "Account", value: settings.accountRef });
    if (settings.bankTransfer) {
      const b = settings.bankTransfer;
      payTo.push({ label: "Bank", value: [b.bank, b.branch].filter(Boolean).join(" · ") });
      payTo.push({ label: "Bank account", value: `${b.accountNo} (${b.accountName})` });
    }
    payTo.push({ label: "Amount (exact)", value: `${settings.currency} ${amountKes.toLocaleString()}` });
    payTo.push({ label: "Your reference", value: reference });

    const instruction: CheckoutInstruction = {
      mode: "manual",
      payTo,
      note:
        settings.instructions ??
        "Pay the exact amount to the Till above, then paste the M-Pesa confirmation code.",
    };
    return instruction;
  },
};
