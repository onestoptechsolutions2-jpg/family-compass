# Commerce decisions

Decided with the owner. Change only with the owner. Newest at the bottom.

## The model: an online shop of things made from family data

- A supermarket: many products, all entry points. Every order is built from
  the family data the customer gives us, or reuses what they already gave.
- The customer chooses. Optional related products may be shown as ways to reuse family data, but are never auto-added or framed as mandatory recommendations.
- Pay first, then made. Full payment before production starts; nothing is made
  or sent to a partner until the payment is verified.
- After payment a partner is assigned by speciality (engraving, printing,
  framing, binding...), makes it, and it is shipped to the customer.

## Answers (2026-09-29)

| Topic | Decision |
| --- | --- |
| Recommendations | Optional complementary products may be shown after the selected product; customers choose each item themselves. |
| Payment | Full price up front (PAY_UP_FRONT_SHARE = 1 in src/lib/orders.ts). |
| Returning customers | They type as normal; we compare typed names against their own tree and ask "Is this the same Ann Kamau already in your family?" to avoid duplicates. Not built yet. |
| Partner assignment | By speciality. Admin chooses from the eligible list and asks them to quote; partner quotes per order; admin accepts one. Built. |
| Partner access | Partner portal with login (Google). Onboarding by invite link or by application that admin approves. Built. |
| Partner proof | Photo of the finished piece (admin approves), then tracking or a dispatch receipt. Built. |
| Partner pay | The quoted price, paid after delivery. Built (recorded by admin). |
| Production | Mostly one partner per order, sometimes several stages. |
| Shipping | Depends on the product (some direct from the partner, some through us for quality checks). |
| First aisles | Memorial and stone; wall art; books and print; events and merchandise. |

## Treat it entirely as an online shop (2026-09-29)

| Topic | Decision |
| --- | --- |
| Storefront | Aisles, search, product pages, cart, checkout, My Orders. Built (branch `shop`). |
| Cart | One cart, several items, one payment. Each item is made and shipped separately. Built. |
| Delivery cost | Included in the product price. No shipping line at checkout. |
| Account | Required before adding to cart (Google sign-in). The personalised draft is kept through sign-in. Browsing and the live preview need no account. |
| Order updates | My Orders page, in-app notifications, and email at each step (email needs EMAIL_SERVER and EMAIL_FROM set). |
| Personalising | Names, dates and family are collected as part of adding the item; family data is built when the order is placed, not for abandoned carts. |

## Open

- Which products ship direct and which come through us first (seeded: stone and
  wood come to us, tile and print ship direct; editable per product).
- Products for the books and print, and events and merchandise aisles, with the
  family data each needs and which speciality makes it.
- Editing an item already in the cart (today: remove it and personalise again).
- Delivery cost for remote areas is absorbed in the price; revisit if margins
  suffer.
- Where partners send pieces that come to us first: set in Admin > Settings.

## The two empty aisles, filled (2026-09-30)

Seven products, all built on one rule: a product is a **layout** (what the piece
looks like and which questions it asks) plus a catalogue row. Cart, payment,
partners and shipping are the same for every layout. See src/lib/layouts.ts.

| Aisle | Product | Layout | Made by | Ships |
| --- | --- | --- | --- | --- |
| Books and print | Memorial prayer cards (packs of 50, 100, 200) | card | printing | direct |
| Books and print | Family birthday calendar (A3, A2) | calendar | printing | direct |
| Wall art | Framed family tree print (A3, A2) | tree | printing then framing | direct |
| Events and merchandise | Reunion T-shirt (S to XXL, one size per line) | shirt | apparel | direct |
| Events and merchandise | Reunion name badges (20 or 50) | badges | printing | direct |
| Events and merchandise | Reunion banner (200 x 100 cm) | banner | printing | direct |
| Events and merchandise | Wedding family tree | wedding | wood engraving | via us |

- **They are switched off** until real supplier prices are set (Admin > Products,
  "On sale"). Prices in the seed are guesses.
- **What each writes to the family record:** a card builds a published memorial;
  a calendar turns every entry with a full birth date into a person with a Birth
  event (entries without a year stay on the calendar only); a wedding tree builds
  both families (both sets of parents, the couple, children); a shirt, banner and
  badges build the customer's family page; badge guests are printed, not added as
  people.
- **Open:** T-shirts print black on a light shirt only; no dark-shirt or colour
  variant. Badges print on one sheet, not tear-off pages. The calendar is a
  one-page year planner, not a 12-page wall calendar.

## Returning customers (2026-09-30)

A customer who already has a family is asked, in the cart, "Is this someone
already in your family?" for every typed name that looks like a person there:
the same full name, or the same first name and surname ignoring middle names and
capitals. Yes reuses that person (no second Peter Kamau, no second couple, no
second set of parents); No makes a separate person. Every question must be
answered before checkout, and an answer can only be a person that was offered.
First-time customers are asked nothing. Different spellings (Anne, Ann) are not
guessed at. See src/lib/matching.ts.

## Editing the cart (2026-09-30)

Each cart item has an Edit link. It opens the wizard on a private copy with
everything filled in; finishing replaces the original (quantity kept, answers
about the old names dropped). Until then the original is untouched, so
abandoning an edit loses nothing. Only the owner of an unpaid cart can edit.
The payment page now lists what is being paid for.

## The landing page and the builder (2026-09-30)

Reference: mysimplefamilytree.com, a free, private, no-sign-up tree builder. We
want that effortless feel, with the commercial step added at the end.

- **Landing page:** storefront first (a short promise, then finished pieces with
  photos or drawn examples and prices, how it works, trust, and the QR explained).
  Every product opens the same free builder. The old family-record pitch lives on
  About. Brand: Family Compass.
- **Builder:** the drawn tree is the editor. Tap a person to change them, tap a
  "+" to add a parent, spouse, brother, sister or child. Same answers as the form,
  so checkout, matching and printing are unchanged. Tree products first.
- **No account to build.** A visitor's tree is saved on our server under a private
  link and remembered in their browser. The account is asked for at "Add to cart".
- **Later:** import an existing tree (GEDCOM) and order from it. The importer
  already exists inside the app.

## Builder: tap the tree (decided)
- Every product opens the same free builder. Family trees and banners are built by tapping a person or a dashed "+" on the drawn tree (3 steps: build, material and size, review); other products keep a short form (4 steps).
- Nothing to sign in to while building. The draft is saved on the server under a private link and remembered in the browser; sign-in is asked only at add-to-cart.
- A browser can only set names and dates. Material, size, price and answers about existing family members are never taken from it.
- GEDCOM import: later.
- Landing page examples are small cached WebP pictures (`/api/sample/<slug>`), not inline drawings, so the page stays light (78 KB).

## Sign-in for customers (decided)
- Shoppers create their own account at /join with name, email and password (on by default; SHOP_SIGNUP=false closes it). No outside keys needed. Google stays optional (OPEN_SIGNUP + keys).
- An existing email is never taken over by sign-up. Sign-in and sign-up are rate-limited; "where to go next" must be a page on this site.
- Forgot password: a one-time emailed sign-in link when email is set up; otherwise the page says to message us on WhatsApp. Account has Change password.
- Email is not verified yet. Acceptable while every order is confirmed by a person checking the M-Pesa proof.

## More products (added, all OFF until priced)
- Wedding tree poster and framed, funeral display poster, framed memorial tree, wooden memorial tree, desk family tree. Each reuses an existing layout, so there is nothing new to draw. Switch each on in Admin, Products after saving a real price.

## Shop is open; variants and generation pricing (decided)
- Every product is on sale (seed creates them on; a one-off migration, `shop_open`, switches on those already in production). Prices and generation rates are still placeholders: set the real ones in Admin, Products. Saving a product marks it price-reviewed, and the launch check still lists any that are not.
- Price = base + material + colour/finish + size + (generations beyond those included x the product's rate). One shared function (`src/lib/product-pricing.ts`) runs in the browser for the live price and on the server for the price charged.
- Generations = rows of family a tree piece shows: the person, parents, grandparents, children. Two are included; each more adds. Cards, calendars, badges and shirts have variants but no generation charge.
- Colour and finish (granite shade, wood tone, paper, frame colour, shirt colour) show in the preview. A shirt's ink follows the shirt colour so it is readable. The server only accepts choices the product offers.
- Admin, Products: each choice's price, and the generation rule, are editable per product. Seeding never overwrites an admin's price.
- Journey and principles: `docs/commerce/JOURNEY.md`.

## Product photos and email (decided)
- **Photos:** an admin uploads up to 8 photos per product in Admin, Products (JPEG, PNG or WebP, up to 8 MB each). They are re-encoded to WebP, resized and stored in the database. Photos may be general or tagged to a product variant. The product page shows matching variant photos, other product photos and a generated mockup of the selected material, finish and size. Off-sale photos are admin-only.
- **Email:** every message is a branded formatted email with a plain-text part. Sent: welcome with a confirm-your-email link, receipt for an order (lists items and total, button to pay), order updates, payment receipt, password sign-in link. The people running the shop are emailed when a payment needs checking or a partner quote or application arrives. A confirm link only confirms; it can never sign anyone in. Email is now "needed for customers" in the launch check, with a test button that reports the real error.
- Email stays optional for the app to run, and a failure to send never breaks an order.

## Reuse the client's family data (decided 2026-10-02)
- A completed checkout persists the client's family in their primary tree. Later product pages may start a new design from the client or a selected person in that same tree.
- Reused names stay linked to their existing people; ambiguous duplicate names still require a customer decision. A product never copies another client's tree.
- Product pages may show up to three active products from the same pathway as optional cross-sells. They are never added to the cart automatically.
- Every new product starts off-sale with no price until supplier pricing and its production route are reviewed.

## Money from day one: the funeral programme, referrals, shop first (decided 2026-10-23)
- **The funeral programme is the lead product.** Families need one within days of a death, so it is
  the first product on the landing page ("Planning a funeral?"). The customer types the details,
  uploads the cover photo and sees the booklet as they go; the app lays it out and makes the print
  file (a 300 dpi PDF, one page per page). Delivered countrywide in 48 hours. The order also builds
  the memorial page the QR on the back opens: the photo is its cover, the life story its eulogy.
- **Variants stay dynamic.** Pages and Copies joined Material, Colour and finish, and Size. Any
  choice can carry a price per copy, multiplied by the copies chosen, so the price follows what
  printing costs: `price = base + each choice's price + copies x each choice's price per copy`.
  An admin edits every choice and its prices per product in Admin, Products. Copies use the number
  as the key (`200|200 copies|0`); a fourth column is the price per copy (`8|8 pages|0|30`).
- **The programme is seeded off sale with placeholder prices** (base 1,500; colour +10 a copy;
  4 to 24 pages at +15 a copy per 4 pages; A4 +15 a copy). Set the real prices from the printer's
  quote and tick On sale.
- **Referrals: anyone can sign up at /refer** (funeral homes, churches, individuals) with a name and
  an M-Pesa number. They share /r/<code> (remembered 30 days) or their code, typed at checkout (a
  typed code wins). They earn **10%** of what the family paid (Admin, Settings; or a rate per
  referrer), recorded when the payment is approved, cancelled if the order is cancelled before it
  is paid out. Nobody earns on their own order. The admin sends the money by M-Pesa and records
  the code in Admin, Referrals. Referrers see amounts only, never who ordered.
- **Shop first.** Research, the developer API, the family directory, communities, chama, deep
  search, friend invites and the family-energy score are hidden unless `GENEALOGY_EXTRAS=true`.
  Nothing is deleted.
- **Open:** draft photos for designs never ordered are kept (no clean-up job yet); the programme
  prints in reading order, and the printer imposes it for folding.

## The funeral fund (harambee) comes back, paid to the family (decided 2026-10-23)
- **The funeral is where Family Compass and Chama meet.** The programme's QR opens the memorial,
  and the memorial takes contributions toward the funeral. Plan, in order: (1) this manual fund on
  Family Compass; (2) Chama's self-recording M-Pesa rails (IntaSend); (3) a short-lived "funeral
  fund" group in Chama that a programme order opens through Chama's API; (4) committee-only totals
  per family branch; (5) after the burial, the committee is invited to become a family welfare
  chama, members pre-filled from the tree; (6) a chama's approved bereavement claim offers a
  programme with the group as referrer.
- **Family Compass never holds contribution money.** Every fund names the family's own M-Pesa
  (phone, paybill and account, or till) and the name M-Pesa shows. The contribute page shows only
  that; the shop's till is never offered for contributions. A fund with no destination takes nothing.
  Contributors record what they sent; the family confirms it against their statement.
- The memorial fund is part of the shop-first product: it no longer depends on GENEALOGY_EXTRAS
  (only CHAMA_ENABLED=false turns it off). The rest of chama (the tree's Chama tab, groups by
  generation) stays an extra.
- The programme wizard asks, optionally, where contributions go; placing the order opens the fund
  and the back page reads "Scan to contribute", with the family's number printed under the QR.

## Funeral funds on Chama (built 2026-10-24, off until Chama's wallets are signed off)
- Contract: Chama's docs/api.md, "Partner API — funeral funds", merged in Chama 67c3a71.
- With CHAMA_PARTNER_URL and CHAMA_PARTNER_TOKEN set, a programme order that collects contributions
  creates the fund on Chama, keyed to the memorial (a retry never makes a second fund). The customer
  chairs the committee; the family's own account is the only payout; branches are the spouse's side
  and each child's household. If Chama cannot take it (unset, wallets off = 503, down), the fund
  stays on the family's own M-Pesa, confirmed by hand. A family can switch an existing fund over
  from the memorial ("Collect by M-Pesa prompt instead").
- Mourners give on Chama's own page (/f/<token>); our /give and the memorial's Contribute go there.
  Hand-recorded pledges are refused on a Chama-run fund.
- Chama's events (/api/partners/chama/webhook) are trusted only with a valid X-Chama-Signature-256
  over "<timestamp>.<raw body>", with the fund's own secret, at most 5 minutes old; a repeated eventId
  is ignored. Totals are also read from Chama (at most once a minute) when the committee opens the page.
  If the first create's answer (with the fund's secret) was lost, a new secret is requested
  (POST /funds/{id}/webhook-secret, on Chama main since 5c589fb).
- Totals by family branch are shown on the memorial's admin page only, never publicly.
- After the burial the committee can start a family welfare chama on Chama, inviting relatives by
  phone (pre-filled from relatives in the tree with a phone on their account).
- Bereavement referrals (/api/partners/chama/bereavement): a chama group becomes an organisation
  referrer (no Family Compass account; code CHAMA<groupId>; payout = the group's nominated account)
  and earns the usual referral share on the programme the family orders. No personal details arrive.

## Three steps to payment (decided 2026-10-24)
- Minimalism first: from any product, **1. Details** (or the tree, for tree pieces), **2. Choose**
  (preview, one line of choices with Change, the total), **3. Pay** (name, M-Pesa number, where to
  deliver, one agreement box), then the M-Pesa payment screen. No account form, no cart, no
  separate consent page in the way.
- The phone number is the account: a new customer gets an account from it at step 3, with no
  password, and is signed in. A number that already has an account is never signed in from here:
  its owner signs in first and comes back to finish.
- Step 1 shows the essential questions; the rest sits under "(optional)". The photo is a large
  tap area with an instant preview.
- The product page is a picture, a short description, "From KES x" and one Start button; choices
  are made in step 2. The cart stays for anyone buying several things ("Add to cart instead").
- The amount charged is rounded up to the nearest 100 (as before); step 2 shows the rounding as its
  own line so the lines add up to the total.
- The payment screen shows one way to pay (the paybill, else the till); others are a tap away.
- The cookie choice is a thin bar at the top, never over the button being tapped.

## A WhatsApp feeling (decided 2026-10-24)
- People already know how to use WhatsApp, so the site borrows its habits: the green they tap
  every day, chat bubbles, and one typing bar at the bottom.
- Step 1 of an order is a chat: we ask one plain question at a time ("What was their first name?",
  "Send a photo for the cover"), the answer comes back as a green bubble with ticks, any answer
  can be tapped to change it, optional ones can be skipped, and the optional extras are offered
  once ("Yes, add them now" / "Later"). It sends the same form as before, so nothing else changed.
  Tree pieces keep the tap-the-tree builder.
- The memorial page opens like a chat: the photo and name in a green header with a share button,
  tributes as bubbles (flowers as small notices), and a bar at the bottom with Message and
  Contribute. The contribute page offers KES 500, 1,000, 2,000 and 5,000 as one-tap amounts.
- A WhatsApp help button sits in the order header.
