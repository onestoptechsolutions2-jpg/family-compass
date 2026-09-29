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
- Returning customers: match typed names against their own tree and ask "is this
  the same person?" (decided, not built).
- Editing an item already in the cart (today: remove it and personalise again).
- Delivery cost for remote areas is absorbed in the price; revisit if margins
  suffer.
- Where partners send pieces that come to us first: set in Admin > Settings.
