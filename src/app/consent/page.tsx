import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { userConsentState } from "@/lib/consent";
import { POLICY_VERSION } from "@/lib/policy";
import { acceptPolicies } from "./actions";

export const metadata = { title: "Consent" };

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; force?: string }>;
}) {
  const me = await requireUser();
  const { next = "/app", error, force } = await searchParams;
  const state = await userConsentState(me.id);
  if (!state.stale && !force) redirect(next.startsWith("/") ? next : "/app");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-6 text-lg font-semibold">
        🧭 Family Compass
      </Link>
      <h1 className="text-2xl font-semibold">Before you continue</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Family Compass is run as a genealogy <strong>data and research project</strong>. Please
        review and accept the current policies (version {POLICY_VERSION}).
      </p>

      <div
        className="mt-4 rounded-xl border p-4 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <ul className="ml-4 list-disc space-y-1">
          <li>You keep ownership and control of what you add.</li>
          <li>Only add data about living people with a lawful basis; mark them as living.</li>
          <li>Sharing and the research directory are off until you turn them on, per tree.</li>
          <li>You can export or delete your data at any time.</li>
        </ul>
        <p className="mt-2">
          Full text:{" "}
          <Link href="/policies/terms" target="_blank" className="text-brand-600 hover:underline">Terms</Link>
          {" · "}
          <Link href="/policies/privacy" target="_blank" className="text-brand-600 hover:underline">Privacy</Link>
          {" · "}
          <Link href="/policies/research" target="_blank" className="text-brand-600 hover:underline">Research &amp; Ethics</Link>
        </p>
      </div>

      {error === "agree" && (
        <p className="mt-3 text-sm text-red-600">You need to accept the Terms and Privacy Policy to use the service.</p>
      )}

      <form action={acceptPolicies} className="mt-4 flex flex-col gap-3 text-sm">
        <input type="hidden" name="next" value={next} />
        <label className="flex items-start gap-2">
          <input type="checkbox" name="agree" required className="mt-0.5" />
          <span>I have read and accept the Terms of Use and Privacy Policy.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="research" defaultChecked={state.researchConsent ?? false} className="mt-0.5" />
          <span>
            <strong>Optional.</strong> Allow my contributions to be used in aggregated,
            de-identified genealogy research (clan distribution, naming trends, etc.). You can
            change this later in your account.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="marketing" defaultChecked={state.marketingConsent ?? false} className="mt-0.5" />
          <span>Optional. Send me occasional project updates.</span>
        </label>
        <button className="mt-1 self-start rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
          Accept &amp; continue
        </button>
      </form>
    </main>
  );
}
