import Link from "next/link";

import { PROJECT_TAGLINE } from "@/lib/policy";
import { PolicyDoc, P } from "@/components/PolicyDoc";

export const metadata = { title: "Policies" };

export default function PoliciesIndex() {
  return (
    <PolicyDoc title="Policies">
      <P>{PROJECT_TAGLINE}</P>
      <P>
        Family Compass is run as a data and research project. Contributors keep ownership and
        control of what they add; the project curates reference data (communities, clans,
        places) and, only with explicit consent, uses aggregated non-identifying patterns for
        genealogical and social research.
      </P>
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <Link href="/policies/terms" className="font-medium text-brand-600 hover:underline">
            Terms of Use
          </Link>{" "}
          — the agreement for using the site.
        </li>
        <li>
          <Link href="/policies/privacy" className="font-medium text-brand-600 hover:underline">
            Privacy Policy
          </Link>{" "}
          — what data we hold, why, and your rights under the Kenya Data Protection Act, 2019.
        </li>
        <li>
          <Link href="/policies/research" className="font-medium text-brand-600 hover:underline">
            Research &amp; Data Ethics
          </Link>{" "}
          — how contributed genealogy may be used for research, and the safeguards.
        </li>
      </ul>
    </PolicyDoc>
  );
}
