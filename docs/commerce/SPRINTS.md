# Commerce sprints

Goal: take the first paid order for a physical Remembered product (tile plaque
with QR, tombstone family tree). Prices are placeholders until supplier quotes.
Definition of done for a story: typecheck and tests pass, migration is safe on
existing data, works on a phone, and it is merged to main behind no broken UI.

## Sprint 1: sell one plaque (order to verified deposit)

Sprint goal: a stranger can design a plaque, pay a deposit by M-Pesa with
proof, and an admin can verify it.

| # | Story | Done when |
| --- | --- | --- |
| 1 | Commerce schema: Product, Order, OrderItem, QrCode, Payment order link | Migration applies; two products seeded |
| 2 | Catalogue pages: two-door home, /remembered, product page | Products render from the database |
| 3 | Plaque wizard with guest draft | Draft saved by token; preview matches layout rules |
| 4 | Account step: social sign-in, create Person and Tree in one transaction | User linked to Person and primary Tree |
| 5 | Approve freezes layout snapshot; QR code minted | /q/{code} redirects to the memorial |
| 6 | Pay deposit with proof | Payment ORDER_DEPOSIT, proof image, AWAITING_VERIFICATION |
| 7 | Admin production queue: verify, send to supplier, cost, stages | Status moves DEPOSIT_VERIFIED to DELIVERED, margin shown |

## Sprint 2: Living poster and reorder loop

Tree poster and wooden tree from a focus person, print files that do not
expire, invite relatives after an order, balance payment, cross-sell offers.

## Sprint 3: growth

Weddings (join two families), reunion kit, partner links, WhatsApp sign-in
for new customers, more materials.

## Before selling (not code)

- Set OPEN_SIGNUP=true, Google and Facebook keys.
- Get two supplier quotes per product and set real prices.
- Decide printed brand (Family Compass or MyRoots) and who fulfils.
- Publish payment instructions (till or paybill) in PaymentSettings.

## Status (2026-09-29)

Built and tested against a real Postgres (scripts/e2e-order.ts, 37 checks) and a
live server: catalogue, guest wizard for both products, account step, family
built in one transaction, memorial or shared family view, QR redirect, deposit
payment with the existing manual M-Pesa flow, admin verification, production
queue with supplier cost and margin, admin product prices, print sheets (SVG
and PNG, QR decode-tested at every size), admin alert when a payment is
submitted. Unit tests: 104. Branch: phase0-user-person-link (not merged).

Not done: screenshot proof upload, photos in the wizard, branded print layout
(dagger, clan emblem), balance payment request, WhatsApp alert to admin, draft
cleanup job, Facebook login (keys not set), wooden tree and grandparents.

## Go-live checklist

1. Merge and deploy; the entrypoint runs the three new migrations and the seed.
2. Set OPEN_SIGNUP=true, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   (redirect URI: APP_URL/api/auth/callback/google).
3. Admin > Products: set real prices from supplier quotes.
4. Admin > Settings: confirm the paybill or till and instructions.
5. Place one real order yourself, pay a small deposit, verify it, and scan the
   printed QR from a phone.
6. Send the /remembered link to the first funeral homes and churches.
