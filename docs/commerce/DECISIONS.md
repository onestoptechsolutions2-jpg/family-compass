# Commerce decisions

Decided with the owner. Change only with the owner. Newest at the bottom.

## The model: an online shop of things made from family data

- A supermarket: many products, all entry points. Every order is built from
  the family data the customer gives us, or reuses what they already gave.
- The customer chooses. The system never recommends or steers.
- Pay first, then made. Full payment before production starts; nothing is made
  or sent to a partner until the payment is verified.
- After payment a partner is assigned by speciality (engraving, printing,
  framing, binding...), makes it, and it is shipped to the customer.

## Answers (2026-09-29)

| Topic | Decision |
| --- | --- |
| Recommendations | None. The customer picks what they want. |
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
