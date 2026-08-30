import { requirePlatformAdmin } from "@/lib/rbac";
import { getPaymentSettings } from "@/lib/payments";
import { darajaConfigured } from "@/lib/payments/daraja";
import { updatePaymentSettings } from "./actions";

export const metadata = { title: "Payment settings" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function AdminSettingsPage() {
  await requirePlatformAdmin();
  const s = await getPaymentSettings();
  const style = { borderColor: "var(--border)", background: "var(--bg)" };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Payment settings</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        The M-Pesa details buyers see at checkout, and how payments are verified.{" "}
        <code>manual_mpesa</code> = pay to the Till and paste the code (admin verifies).{" "}
        <code>mpesa_daraja</code> = STK Push straight from Safaricom — it needs the{" "}
        <code>MPESA_*</code> server variables set{" "}
        {darajaConfigured ? (
          <strong style={{ color: "var(--success)" }}>(configured ✓)</strong>
        ) : (
          <strong style={{ color: "var(--warning)" }}>(not configured yet)</strong>
        )}
        .
      </p>

      <form
        action={updatePaymentSettings}
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Provider</span>
            <select name="provider" defaultValue={s.provider} className={field} style={style}>
              <option value="manual_mpesa">Manual M-Pesa Till (paste code)</option>
              <option value="mpesa_daraja">M-Pesa STK Push (Daraja){darajaConfigured ? "" : " — set MPESA_* first"}</option>
            </select>
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Verification</span>
            <select
              name="verificationMode"
              defaultValue={s.verificationMode}
              className={field}
              style={style}
            >
              <option value="MANUAL">Manual (admin approves)</option>
              <option value="AUTO_CODE" disabled>
                Auto-match code
              </option>
              <option value="WEBHOOK" disabled>
                Webhook
              </option>
            </select>
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Currency</span>
            <input name="currency" defaultValue={s.currency} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Single-export price</span>
            <input
              type="number"
              name="defaultPriceKes"
              defaultValue={s.defaultPriceKes}
              className={field}
              style={style}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Family plan price / year</span>
            <input type="number" name="keeperPriceKes" defaultValue={s.keeperPriceKes} className={field} style={style} />
          </label>

          <div className="col-span-2 mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Size-based print pricing
          </div>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Free generations</span>
            <input type="number" name="priceFreeGenerations" defaultValue={s.priceFreeGenerations} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Free nodes</span>
            <input type="number" name="priceFreeNodes" defaultValue={s.priceFreeNodes} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Per extra generation</span>
            <input type="number" name="pricePerGenerationKes" defaultValue={s.pricePerGenerationKes} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Per extra node</span>
            <input type="number" name="pricePerNodeKes" defaultValue={s.pricePerNodeKes} className={field} style={style} />
          </label>

          <div className="col-span-2 mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Deep search & Research Partner
          </div>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Deep search price</span>
            <input type="number" name="deepSearchPriceKes" defaultValue={s.deepSearchPriceKes} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Research base</span>
            <input type="number" name="researchBaseKes" defaultValue={s.researchBaseKes} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Research per generation</span>
            <input type="number" name="researchPerGenerationKes" defaultValue={s.researchPerGenerationKes} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Research per node</span>
            <input type="number" name="researchPerNodeKes" defaultValue={s.researchPerNodeKes} className={field} style={style} />
          </label>

          <label className="text-sm col-span-2">
            <span style={{ color: "var(--muted)" }}>Business name</span>
            <input name="businessName" defaultValue={s.businessName ?? ""} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Till / Buy Goods no.</span>
            <input name="tillNumber" defaultValue={s.tillNumber ?? ""} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Store no.</span>
            <input name="storeNumber" defaultValue={s.storeNumber ?? ""} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Paybill no.</span>
            <input name="paybillNumber" defaultValue={s.paybillNumber ?? ""} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Account ref</span>
            <input name="accountRef" defaultValue={s.accountRef ?? ""} className={field} style={style} />
          </label>
        </div>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Checkout instructions</span>
          <textarea
            name="instructions"
            defaultValue={s.instructions ?? ""}
            rows={3}
            className={field}
            style={style}
          />
        </label>
        <div>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
