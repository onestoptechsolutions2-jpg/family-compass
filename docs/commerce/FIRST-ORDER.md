# Your first real order, end to end

Do this yourself, signed in as an admin, before any customer does. It exercises
every step a customer, you and a partner will go through. Allow one hour, plus
production and delivery time. Use a small real amount if you can: the point is
to prove the money and the piece both arrive.

Open **Admin > Launch** first. It shows what is missing, in plain words, and
gives two verdicts: ready for a test order by you, and ready for customers.

## Before you start (once)

1. **Admin > Settings**: your paybill or till (and account reference) or bank
   details, and "where partners send finished pieces" (your address).
2. **Admin > Products**: choose one product for the test. Enter its real price
   from a supplier quote and **Save** (saving is what marks it reviewed), and
   tick **On sale**. Leave the others as they are.
3. **Admin > Partners**: invite one partner who can make it (their Google email).
   Send them the link. They open it while signed in with that Google account.
4. Confirm your own admin sign-in works (password login on /login).

To let strangers in, also set OPEN_SIGNUP=true, GOOGLE_CLIENT_ID and
GOOGLE_CLIENT_SECRET and redeploy (Google redirect URI: your site address plus
/api/auth/callback/google). Until then only admins can sign in, which is fine
for this test.

## The order

| # | You do | You should see | If not |
| --- | --- | --- | --- |
| 1 | Open the shop, choose the product, "Personalise and add to cart" | The wizard with a live preview of the real piece | Note the step and message |
| 2 | Fill in a real family, choose material and size, review, "Add to cart" | You land on the cart with a picture of your design | Sign in as admin if asked |
| 3 | Cart: fill in delivery, "Place order and pay" | The payment page listing the item and the price | Check Admin > Launch |
| 4 | Pay by M-Pesa to the paybill shown, paste the confirmation code, "I have paid" | "Payment being checked". You get an in-app notice | Wrong details: fix in Settings |
| 5 | **Admin > Payments**: you were alerted; check the money arrived, Approve | The payment turns Paid | Reject with a reason if it did not arrive |
| 6 | **Admin > Orders**: the order shows "Paid, ready for production". Under the job, tick the partner, "Ask to quote" | The partner is notified | No partner listed: their speciality is missing |
| 7 | **Partner** (their own login): open the job, check the print sheet, send a quote | The quote appears in Admin > Orders with your margin | |
| 8 | **Admin**: Accept the quote | The partner is told they got the job | |
| 9 | **Partner**: Start production, make it, photograph it with the QR visible, send the photo | You see the photo in Admin > Orders | |
| 10 | **Admin**: **scan the QR in the photo with a phone** and check every name, then Approve | The partner is told to ship | Send it back with the reason |
| 11 | **Partner**: enter courier and tracking, "I have shipped it" | Direct products: the customer's item shows "On its way". Others: it is on its way to you | |
| 12 | Products that come to you first: check the piece in your hands, scan the QR, "Ship to customer" with tracking | The item shows "On its way" in My Orders | |
| 13 | After delivery: **Mark delivered** | My Orders says Delivered; the customer gets an email if email is set up | |
| 14 | **Admin > Orders**: pay the partner their quoted price, record the reference | "Partner paid" | |

## What to check at the end

- The QR on the piece opens the right page, from a phone, on mobile data.
- The margin shown (what the customer paid minus the partner's cost) is what you
  expected. If it is not, the price or the quote needs changing before customers.
- Every name and date on the piece is spelled as entered.
- My Orders showed the right status at every step.
- Total time from payment to delivery. That is what you can promise customers.

## Then open to customers

1. Set the real price on every product you will sell and switch them on.
2. Make sure Admin > Launch says **Ready for customers**.
3. Set OPEN_SIGNUP=true and the Google keys, redeploy, and try signing in with a
   different Google account.
4. Send the shop link to your first customers.

## If something breaks

Write down the step, what you did and what you saw (a screenshot helps), and
send it. Nothing in this flow deletes data: a stuck order can be cancelled in
Admin > Orders and the customer's family is kept.
