import { PolicyDoc, P, H, UL } from "@/components/PolicyDoc";

export const metadata = { title: "Research & Data Ethics" };

export default function ResearchPolicyPage() {
  return (
    <PolicyDoc title="Research & Data Ethics">
      <P>
        Family Compass exists to help Kenyan families record their history <em>and</em> to
        build, responsibly, an open picture of how families, clans, and communities connect —
        beginning with Western Kenya. This policy sets the rules for that research use.
      </P>

      <H>What &quot;research use&quot; means here</H>
      <UL>
        <li>Curating reference data — communities, clan names, totems, places — from contributions and published sources.</li>
        <li>Studying <strong>aggregated, de-identified patterns</strong>: clan distribution across wards, migration and naming trends, average family sizes by generation, and similar.</li>
        <li>Improving matching (&quot;are we related?&quot;, deep search) using non-identifying signals.</li>
      </UL>
      <P>
        It does <strong>not</strong> mean publishing your family tree, selling personal data,
        or sharing identifiable records with third parties.
      </P>

      <H>Consent</H>
      <UL>
        <li>Research use of your contributions is <strong>opt-in</strong>. You choose when you first accept the policies, and can change it any time in your account.</li>
        <li>If you opt out, we stop including your contributions in new research datasets and remove them from working datasets at the next refresh. Already-published aggregate statistics that cannot be traced back to you may remain.</li>
        <li>The <strong>research directory</strong> and <strong>deep search</strong> are separate and controlled per tree by its owner — turning them on is its own explicit choice.</li>
      </UL>

      <H>Safeguards</H>
      <UL>
        <li><strong>Living people:</strong> excluded from research datasets and from public directory detail unless the tree owner explicitly includes them.</li>
        <li><strong>Private records:</strong> anything marked private is never in the directory, deep search, or research.</li>
        <li><strong>Minimisation:</strong> research datasets drop names, exact dates, contact details, photos, and notes — keeping only what a given study needs.</li>
        <li><strong>No re-identification:</strong> outputs are reviewed so individuals can&apos;t be singled out.</li>
        <li><strong>Community benefit:</strong> reference data and aggregate findings are shared back with contributors and communities.</li>
      </UL>

      <H>Corrections &amp; disputes</H>
      <P>
        Genealogy is often contested. Anyone can dispute a record about themselves or a close
        relative; tree owners and the project will review it. Relationship and clan checks are
        based only on recorded data and are informational — not proof of ancestry, and not
        legal or medical advice.
      </P>

      <H>Updating a deceased person&apos;s record &amp; memorialised profiles</H>
      <UL>
        <li>
          A record does not close when a person dies. Their profile stays editable by tree
          editors so families can keep correcting facts, adding photos, sources, and stories,
          and completing relationships.
        </li>
        <li>
          A person with a recorded death or burial can be given a <strong>memorial page</strong>:
          a public tribute, eulogy, photo gallery, funeral programme, and moderated guestbook.
          Memorial pages are only offered for deceased people and are opt-in per person — an
          editor has to open one.
        </li>
        <li>
          <strong>Funeral programmes are auditable.</strong> Every save is versioned: who
          changed it, when, and an optional note are kept as revision history that editors can
          review. This is deliberate — a programme is a shared family document during a
          sensitive time.
        </li>
        <li>
          <strong>Living relatives stay protected.</strong> Names of living kin appear in the
          &quot;survived by&quot; section and in the printable memorial book only when the
          memorial&apos;s &quot;include living family&quot; setting is on; anyone marked private
          is always excluded.
        </li>
        <li>
          <strong>Guestbook entries</strong> are moderated by default. Editors approve or hide
          each message; hidden and pending messages are never shown publicly. We keep a
          submission IP for abuse handling only.
        </li>
        <li>
          Close relatives can ask a tree owner (or the project) to correct, unpublish, or
          remove a memorial. Requests about a recently deceased person from immediate family
          are given priority.
        </li>
      </UL>

      <H>Researchers &amp; partners</H>
      <P>
        Commissioned &quot;Research Partner&quot; work is done under a written scope for a
        specific client and is governed by these ethics plus the Terms. Any external
        researcher given access to non-aggregated data must sign a data-use agreement.
      </P>
    </PolicyDoc>
  );
}
