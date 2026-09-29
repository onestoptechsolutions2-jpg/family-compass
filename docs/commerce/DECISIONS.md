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
| Partner assignment | By speciality matched to the order. Details open. |
| Partner access | Partner portal with login. Not built yet. |
| Production | Mostly one partner per order, sometimes several stages. |
| Shipping | Depends on the product (some direct from the partner, some through us for quality checks). |
| First aisles | Memorial and stone; wall art; books and print; events and merchandise. |

## Open

- How partners sign in and are onboarded; how they are paid and when.
- Which products ship direct and which come through us first.
- Product requirements (which data each product needs) and the generic order
  flow that reads them, so a new product is data, not code.
