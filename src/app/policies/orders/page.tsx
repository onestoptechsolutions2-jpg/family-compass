import { PolicyDoc, P, H, UL } from "@/components/PolicyDoc";

export const metadata = { title: "Orders, delivery and refunds" };

/**
 * The terms for physical orders. The figures (7 days, 48 hours) are the shop's stated promises:
 * change them here and in docs/commerce/DECISIONS.md together, and bump POLICY_VERSION.
 */
export default function OrdersPolicyPage() {
  return (
    <PolicyDoc title="Orders, delivery and refunds">
      <P>
        These terms cover the physical pieces we make for you: plaques, trees, prints, cards, calendars,
        shirts, badges and banners. Every piece is made to order from the names and dates you give us, so
        a few things work differently from buying something off a shelf.
      </P>

      <H>What you are buying</H>
      <UL>
        <li>The price you see is the price you pay, in Kenyan Shillings. <strong>Delivery to the address you give us in Kenya is included.</strong></li>
        <li>Your piece shows the people, spellings and dates you approved at the review step, in the material, colour and size you chose. We make exactly that.</li>
        <li>Each piece carries a QR code that opens your family&apos;s page. The page is part of what you buy and stays online while your account exists.</li>
      </UL>

      <H>Paying</H>
      <UL>
        <li>You pay the full price by M-Pesa before we start. A person at Family Compass checks the payment against our M-Pesa statement and then confirms it by email and in your account.</li>
        <li>Nothing is made until your payment is confirmed. If the amount that arrives is less than the price, we will ask you for the rest.</li>
        <li>An M-Pesa confirmation code can only be used once. A code that has already paid for another order is refused.</li>
      </UL>

      <H>Checking your details</H>
      <UL>
        <li>Please check every name, spelling and date at the review step. We reproduce what you approved.</li>
        <li>If we get something wrong, or the piece is not what you approved, we will make it again at no cost. If what you gave us was wrong, we cannot make a corrected piece for free, but we will tell you what a new one costs.</li>
      </UL>

      <H>Changing or cancelling</H>
      <UL>
        <li><strong>Before production starts</strong> (before a maker has accepted the work) you can cancel for a full refund. Contact us as soon as you can.</li>
        <li><strong>After production starts</strong> a personalised piece cannot be cancelled or returned because you changed your mind, because it is made for you and cannot be sold to anyone else. We will still try to help, and may be able to stop work in some cases.</li>
        <li>Refunds are paid back to the M-Pesa number you paid from, within <strong>7 days</strong> of us agreeing to them. We record every refund against your order.</li>
      </UL>

      <H>Making and delivery</H>
      <UL>
        <li>Skilled makers in Kenya produce your piece. Before it ships we photograph it and scan its QR code to make sure it works.</li>
        <li>We tell you the expected time once a maker has taken the job, and email you when your piece is made, on its way and delivered. Heavy pieces such as stone and wood come to us first and we send them on.</li>
        <li>Please give an address and phone number that will be answered on the day. If delivery fails because we cannot reach you, we will contact you to arrange it again.</li>
      </UL>

      <H>If something arrives wrong</H>
      <UL>
        <li>Check your piece when it arrives. If it is damaged, faulty or does not match what you approved, tell us within <strong>48 hours</strong> with a photo, and no later than 7 days after delivery.</li>
        <li>We will remake it or refund you, whichever you prefer where that is possible. You do not pay for the remake or its delivery.</li>
      </UL>

      <H>Your family page and QR code</H>
      <UL>
        <li>The QR code on your piece points to your family page. We keep that page working while your account exists.</li>
        <li>If you delete your account, your family page is removed and the QR code on a piece you already own will stop working. We will warn you before this happens.</li>
      </UL>

      <H>To the extent the law allows</H>
      <P>
        Nothing here limits any right you have under Kenyan law. If you are not happy with how we have
        handled something, tell us and we will put it right, or explain why we cannot.
      </P>

      <H>Contact</H>
      <P>Message us on WhatsApp (0113 352 048) with your order reference, or use the contact channel shown in the app.</P>
    </PolicyDoc>
  );
}
