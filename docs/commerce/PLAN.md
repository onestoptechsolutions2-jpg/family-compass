# Commerce plan: physical family products on Family Compass

Handoff from the Eulogy prototype session, 2026-09-29. This repo is the real
product (myroots.laitor.co.ke). The Eulogy repo (Drizzle/Neon, package
`mizizi`) was an earlier prototype and is retired; do not build there.

## Goal

Every product is an entry point into the family record. A visitor picks a
product, a guided wizard collects what is needed to produce it, and the
answers create or enrich the family data. Revenue comes first: paid orders for
memorial programmes, tile plaques and tombstone family trees, produced by
outside suppliers, paid by M-Pesa with manual proof.

Two front doors: **The Living** (family tree poster, wooden tree, wedding,
reunion) and **The Remembered** (memorial page, programme, plaque, tombstone).
Ship the Remembered slice first: the funeral is the strongest buying moment
(fixed date, family spends, hundreds of mourners see the product).

## Decisions already made

- Tree is not a product; it is a view generated from a focus person over
  people and relationships. The family is the container.
- One user table. Each user belongs to one family and is one person
  (Family Compass currently allows many memberships and an optional
  `claimedPerson`; enforce a primary tree and claimed person at sign-in).
- Payments: several methods, manual proof of payment recorded against the
  method. Reuse the existing `Payment` model and admin verification.
- Suppliers do all printing, engraving and stone work. We own the customer,
  the design and the data, and earn the markup. Take at least half upfront
  before sending anything to a supplier.
- Social sign-in (Google, Facebook) plus WhatsApp; make the flow easy for
  non-technical users: one plain question per screen, progress saved, skip
  allowed, live preview, phone first, WhatsApp help button.

## What Family Compass already has

Memorials (`/m/[slug]`), funeral programmes, generation jobs with watermarked
preview then M-Pesa payment then clean file, credits, Memorial Pass (KES 1,500),
Chama welfare, research engagements, identity layer, WhatsApp claim sign-in,
worker queues, webhooks, API, admin console.

## What is missing (build this)

1. `Product`, `Order`, `OrderItem` for physical goods: material, size,
   wording, delivery or grave location, quantity, price.
2. A production status and an admin production queue (verify payment, send to
   supplier, in production, shipped, delivered). Supplier and cost tracking so
   margin is visible.
3. `PaymentKind` for orders; reuse `Payment` (manual M-Pesa, proof, admin
   verify). Deposit then balance.
4. QR codes: a permanent short URL per person or memorial (`/q/<code>` to the
   memorial page), image attached to the order item.
5. Layout snapshot frozen at customer approval, so later edits to the family
   never change a paid product. Reuse the generation pipeline for print files.
6. Guided configurator with a guest draft (session token), converted to
   account and family at the account step.

## Layout rules from the samples (docs/commerce/samples)

One layout, many skins: focus person centre, ancestors above, spouse beside,
children and siblings below; a dagger mark for the deceased; a QR; a clan
emblem (for example a grasshopper). Wood and granite are just materials.

- No silent truncation of names. Wrap or shrink, and warn before approval.
- Density limit per size (the samples carry about 20 people).
- The samples are signed "Family Compass". Confirm the printed mark.

## Wizard (tombstone example: late mother, grasshopper tree, tile, QR)

1 choose product; 2 who it is for (name, dates, living or deceased, photo,
epitaph); 3 who to show (parents, spouse, children, siblings, generations);
4 emblem; 5 material and size with live price; 6 QR position; 7 preview and
approve; 8 delivery or installation; 9 contact and account; 10 pay.

## Sprint 1 proposal

Physical-product order layer: `Product`, `Order`, `OrderItem`, production
status, `PaymentKind` for orders, admin queue, QR for memorial pages. Seed the
tile plaque and tombstone tree first; prices are placeholders until supplier
quotes arrive. Work on a feature branch; the Docker entrypoint runs
`prisma migrate deploy`, so a schema change goes live with a deploy.

## Prices to validate (guesses, not researched)

Programme booklet KES 15k to 45k; memorial banner or framed tree 5k to 25k;
tombstone or tile family-tree add-on 30k to 150k; wooden wall tree 3k to 35k.
Get real supplier quotes first.

## Open questions

- Which payment methods go live first (M-Pesa Till, paybill, bank)?
- Who fulfils production, and are suppliers signed yet?
- Printed brand: Family Compass or MyRoots?
- Can a family have several owners?
- Who are the first ten customers (funeral homes, churches, monument makers)?

## Reference

Blueprint and build plan doc (Claude Docs): https://claude.ai/code/artifact/736f9af7-8b25-4422-9fd4-5c09f211a864
Note: its data-model sections describe the Eulogy schema; the commerce,
configurator, sign-in and revenue sections apply here.
