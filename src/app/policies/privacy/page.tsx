import { PolicyDoc, P, H, UL } from "@/components/PolicyDoc";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <PolicyDoc title="Privacy Policy">
      <P>
        This explains what personal data Family Compass holds, why, and your rights under the
        Kenya Data Protection Act, 2019. The project is the data controller for account data
        and the reference dataset; each tree owner is the controller for the genealogy in
        their tree, and the project processes it on their behalf.
      </P>

      <H>What we collect</H>
      <UL>
        <li><strong>Account:</strong> name, email or WhatsApp number, a password hash if you set one, and sign-in / session records.</li>
        <li><strong>Genealogy you enter:</strong> names, relationships, dates, places, clan/community, photos and documents, notes.</li>
        <li><strong>Claims &amp; connections:</strong> when you claim a profile or request a connection, your name, phone, and message.</li>
        <li><strong>Payments:</strong> amount, reference, the M-Pesa code you submit, and verification status. We do not store card details.</li>
        <li><strong>Technical:</strong> IP address, device/browser, and basic logs for security and debugging. Essential cookies only unless you accept optional ones.</li>
        <li><strong>Consent records:</strong> which policy version you accepted and when, and your research/marketing choices.</li>
      </UL>

      <H>Why we use it (lawful bases)</H>
      <UL>
        <li><strong>To run the service</strong> you asked for — performance of a contract.</li>
        <li><strong>Security, fraud prevention, accounting</strong> — legitimate interests / legal obligation.</li>
        <li><strong>Research use of aggregated, non-identifying data</strong> — only with your explicit opt-in consent (see the Research policy), which you can withdraw at any time.</li>
        <li><strong>Directory listing &amp; deep search</strong> — only for trees whose owner turned this on; only non-private records; living people are shown as &quot;Living &lt;surname&gt;&quot; unless the owner opts in.</li>
      </UL>

      <H>Sharing</H>
      <UL>
        <li>People you invite to a tree; visitors to a public shared view you create.</li>
        <li>Other members via the research directory / deep search, if the tree owner enabled it — limited to name, clan, community, approximate year, and a contact number for a connection request.</li>
        <li>Service providers: our hosting and email/SMS/WhatsApp message delivery, under contract.</li>
        <li>Authorities where legally required.</li>
        <li>We do <strong>not</strong> sell personal data.</li>
      </UL>

      <H>Retention</H>
      <P>
        Genealogy is kept until the tree owner deletes it. Account data is kept while your
        account is active and for a short period after, minus what we must keep for legal and
        accounting reasons. Consent and payment records are kept for audit.
      </P>

      <H>Your rights</H>
      <P>
        You can access, correct, export, or delete your data, object to or restrict certain
        processing, and withdraw consent. Trees can be exported as GEDCOM or .gramps at any
        time. To exercise a right, contact us through the app; we respond within the statutory
        timeframe. You may also complain to the Office of the Data Protection Commissioner.
      </P>

      <H>Children &amp; living people</H>
      <P>
        Add data about a living person only with a lawful basis, and about a child only with a
        parent/guardian&apos;s consent. Anyone can ask us to remove or restrict their own
        record.
      </P>

      <H>Storage &amp; transfers</H>
      <P>
        Data is stored in the project&apos;s database (photos and documents included). If any
        processor is outside Kenya, we use appropriate safeguards.
      </P>
    </PolicyDoc>
  );
}
