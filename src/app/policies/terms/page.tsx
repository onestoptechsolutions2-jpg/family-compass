import { PolicyDoc, P, H, UL } from "@/components/PolicyDoc";

export const metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <PolicyDoc title="Terms of Use">
      <P>
        By using Family Compass you agree to these terms. If you are entering data about other
        people, you also agree to the <a className="text-brand-600 hover:underline" href="/policies/research">Research &amp; Data Ethics</a> policy.
      </P>

      <H>The project</H>
      <P>
        Family Compass is a genealogy and family-history research project. You can build family
        trees, invite relatives, publish read-only views, and buy print-ready charts, data
        exports, cross-tree searches, or commissioned research.
      </P>

      <H>Your account</H>
      <UL>
        <li>Access is by invitation or an approved claim. You are responsible for your account and any sign-in link sent to you.</li>
        <li>Provide accurate contact details. Don&apos;t impersonate anyone or claim a profile that isn&apos;t you.</li>
        <li>We may suspend accounts that abuse the service, other members, or other people&apos;s data.</li>
      </UL>

      <H>Content you add</H>
      <UL>
        <li>You keep ownership of the genealogical content you contribute. You grant the project a licence to store, display, and process it to run the service (including sharing it with people you invite and, if you turn it on, listing non-private records in the research directory).</li>
        <li>Only add information about living people if you have a lawful basis — usually their consent, or that of a parent/guardian for a child. Mark living people as living so shares redact them.</li>
        <li>Don&apos;t upload content that is unlawful, defamatory, or infringes someone else&apos;s rights.</li>
      </UL>

      <H>Payments</H>
      <UL>
        <li>Building and sharing is free. Downloads, deep searches, the Family plan, and Research Partner engagements are paid, priced as shown before you pay.</li>
        <li>Payments are made by M-Pesa and verified manually. Prices are in Kenyan Shillings.</li>
        <li>Digital goods (charts, exports, unlocked searches) are delivered on payment and are non-refundable once delivered, except where a delivered file is wrong on our side — contact us and we&apos;ll fix or refund it.</li>
        <li>Research Partner engagements are governed by the written quote and scope agreed for that project.</li>
      </UL>

      <H>Availability &amp; liability</H>
      <P>
        The service is provided &quot;as is&quot;. We aim for accuracy and uptime but can&apos;t
        guarantee either. Genealogical conclusions and any relationship or clan check are
        informational only and are <strong>not legal, medical, or ancestry-verification
        advice</strong>. To the extent the law allows, our liability for any claim is limited
        to the amount you paid us in the previous 12 months.
      </P>

      <H>Ending use</H>
      <P>
        You can delete your trees and account at any time. You can export your data first
        (GEDCOM / .gramps). We keep minimal records needed for legal, accounting, and
        anti-abuse purposes.
      </P>

      <H>Changes &amp; contact</H>
      <P>
        We may update these terms; material changes re-prompt you to accept. Questions or
        data requests: use the contact channel shown in the app.
      </P>
    </PolicyDoc>
  );
}
