# Family Compass

A **community genealogy & family-history research project** for Kenyan families,
starting in Western Kenya. Families record their own history (people, clans,
places); with explicit opt-in consent, the project studies aggregated,
de-identified patterns. Built on the Gramps data model.

Building & sharing is free. Print charts, cross-tree deep search, the annual
Family plan, and commissioned research are paid (M-Pesa).

### Data & consent

- **Policies** live at `/policies` (Terms, Privacy — Kenya DPA 2019 aware,
  Research & Ethics). `POLICY_VERSION` in `src/lib/policy.ts`; bump it to
  re-prompt everyone.
- **Consent gate**: `src/app/(app)/layout.tsx` redirects to `/consent` until
  `User.consentVersion` matches. `/consent` records acceptance + optional
  research/marketing opt-ins; `ConsentEvent` is the immutable audit. Toggle
  research consent later in `/account`.
- **Cookie banner** (`ConsentBanner`, Consent-Mode-v2 style): essential storage
  always; analytics only after "Accept all" (`window.__fcConsent`).
- Sharing, the research directory (`Tree.discoverable`), and showing living
  people are **off by default**, per tree.
- Seed loads reference data: ~420 Western/Nyanza admin units (`KenyaLocation`)
  and ~56 community/clan starter rows (`ReferenceClan`, browsable at
  `/communities`).

- **Stack:** Next.js 16 (App Router) · Prisma · PostgreSQL · Auth.js v5 · pg-boss
- **Media** is stored in Postgres (`MediaObject.bytes`).
- **Deploy target:** Coolify (Docker Compose: `app` + `worker` + `postgres`).

---

## Build status

| Phase | Scope | State |
|------|-------|-------|
| 0 | Scaffold, schema, Docker/Coolify, Auth.js, health check | ✅ done |
| 1 | People / Families CRUD, Events / Places / Sources lists, tree settings | ✅ done |
| 2 | `.gramps` XML + GEDCOM importers (background jobs) | ✅ done (Gramps verified on seed data; GEDCOM needs a real-file test) |
| 3 | Interactive pan/zoom tree — ancestors / hourglass / descendants / fan chart, click-to-re-root, keyboard nav, jump-to-person, set home person | ✅ done |
| 4 | Media upload (Postgres bytea) + `sharp` thumbnails + `/api/media/[id]` with auth, ETag, range · gallery + per-person photos · 10 MB/file, 250 MB/tree quota | ✅ done |
| 5 | Role management + `/trees/…/sharing`, public `/s/[slug]` read-only tree (living-person redaction, optional password/expiry), `/updates` feed. **WhatsApp self-onboarding**: claim an existing node from a shared view → admin approves in `/trees/…/claims` → one-tap `wa.me` sign-in link (`/api/auth/wa/[token]`). No email/passwords required. | ✅ done |
| 6 | Paid generation — watermarked preview → first-free / credit / M-Pesa Till bundle → admin verify → clean download. Pedigree/fan/descendant PDF, family-book PDF, GEDCOM + `.gramps` exports. Pluggable payment provider + `/admin/payments` + `/admin/settings` | ✅ done |
| 7 | Marketing pages, rate limiting, audit log, backups, admin console | ⏳ planned |

Full plan: `.claude/plans/async-inventing-fountain.md` (or ask).

---

## Local development

```bash
cp .env.example .env          # then edit AUTH_SECRET etc.
docker compose up -d postgres # just the DB
npm install
npm run db:deploy             # apply migrations
npm run db:seed               # global PaymentSettings row
npm run dev                   # http://localhost:3000
npm run worker:dev            # background jobs (imports etc.) in another shell
```

Sign-in needs **either** Google OAuth **or** an SMTP server:

- Google: set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, redirect URI
  `http://localhost:3000/api/auth/callback/google`.
- Email magic link: set `EMAIL_SERVER=smtp://user:pass@host:587` and `EMAIL_FROM`.

Put your email in `ADMIN_EMAILS` to get the platform-admin role on first sign-in.

### Load the sample tree

Create a tree in the UI, open **Import**, and upload `seed/family-compass.gramps`
(the original Gramps' Compass database — 96 people, 27 families).

---

## Deploy on Coolify

1. **New Resource → Docker Compose**, point it at this repo (`docker-compose.yml`).
2. Set environment variables in the Coolify UI. Nothing is baked into the
   image — the compose file **refuses to start** without the required ones:

   | Variable | Req? | Notes |
   |---|---|---|
   | `APP_URL` / `AUTH_URL` | ✅ | public origin, no trailing slash — e.g. `https://myroots.laitor.co.ke` |
   | `AUTH_SECRET` | ✅ | `openssl rand -base64 33` |
   | `POSTGRES_PASSWORD` | ✅ | strong value |
   | `DATABASE_URL` | ✅ | `postgresql://<user>:<pw>@postgres:5432/<db>?schema=public` (match `POSTGRES_*`) |
   | `APP_PORT` | — | host port the container is published on (point your domain/proxy here), e.g. `9090` |
   | `PORT` | — | port Next listens on inside the container (default `3000`) |
   | `POSTGRES_USER` / `POSTGRES_DB` | — | default `familycompass` |
   | `GOOGLE_CLIENT_ID` / `_SECRET` | — | one sign-in method needed |
   | `EMAIL_SERVER` / `EMAIL_FROM` | — | the other sign-in method (magic link) |
   | `ADMIN_EMAILS` | — | comma-separated; platform-admin on first sign-in |
   | `OPEN_SIGNUP` | — | `false` (default) = invite-only, no self-service registration; `true` = anyone may sign in |
   | `ALLOWED_SIGNUP_EMAILS` / `_DOMAINS` | — | extra addresses / whole domains allowed to sign in |
   | `RUN_SEED_ON_MIGRATE` | — | `true` on the very first deploy only |

3. Attach your domain (e.g. `myroots.laitor.co.ke`) to the **`app`** service.
   Coolify's proxy routes it to the container's `$PORT`; `APP_PORT` is the
   host-published port if you front it yourself.
4. Deploy. On boot the `app` container runs `prisma migrate deploy`
   (`RUN_MIGRATIONS=true`); the `worker` container has it disabled to avoid a
   migration race.
5. First deploy: set `RUN_SEED_ON_MIGRATE=true` **or** run `npm run db:seed`
   once via a Coolify terminal on the **`app`** container. This:
   - creates the global `PaymentSettings` row, and
   - creates a **super-admin** from `SUPERADMIN_EMAIL` (or `ADMIN_EMAILS[0]`)
     and **prints a one-time sign-in link** to the logs
     (`<APP_URL>/api/auth/link/<token>`, single use, 7 days).

   Open that link → you're signed in as platform admin. Then set your M-Pesa
   Till / Store number in **/admin/settings** and verify payments at
   **/admin/payments**. Need a fresh link later: `npm run admin:link`.

   **Password login (optional):** set `SUPERADMIN_PASSWORD` (10+ chars) before
   seeding to also enable **email + password** sign-in for that admin — the
   "Admin sign-in" box on `/login`. The one-time link stays as a fallback.
   Any signed-in user can set/change/remove their password in **/account**.

### Accounts & sign-in

No registration form, no passwords. The primary path is **WhatsApp
self-onboarding**:

1. A relative opens a public shared view (`/s/<slug>`) that has **claims** enabled.
2. They tap their own node → **"This is me"** → enter name + WhatsApp number.
3. They send a one-tap `wa.me` message (with a code) to the tree admin's number.
4. The admin approves in **`/trees/<id>/claims`** — this links the new account
   to the **existing** person record (no duplicate) and mints a one-time
   sign-in link.
5. The admin taps **"Send sign-in link on WhatsApp"**; the relative opens it and
   is signed in (`/api/auth/wa/<token>` → database session).

Set the admin's number and an optional "family word" PIN on the Sharing page.
`ADMIN_EMAILS` still grants the platform-admin role on first sign-in.

**Google OAuth** is an optional alternate (`GOOGLE_CLIENT_ID` / `_SECRET`),
gated by the same allow-list (`OPEN_SIGNUP`, `ALLOWED_SIGNUP_EMAILS`,
`ALLOWED_SIGNUP_DOMAINS`). `EMAIL_SERVER` / `EMAIL_FROM` are now **fully
optional** — only used if you also want the older email-invite flow.

### Monetization model (phase 6)

Free to build, invite, and publish shared links.

- **Downloads (size-based).** First export per tree free. After that
  `price = per-document base + (generations − free) × perGen + (nodes − free) ×
  perNode` — computed when the preview renders, shown before you pay. A credit
  is worth the standard price; a big generation costs `ceil(price / standard)`
  credits. Bundles: `SINGLE` KES 750 · `BUNDLE_5` KES 2,500 · `BUNDLE_15`
  KES 6,000.
- **Family plan** (`PaymentKind.KEEPER`) — KES 3,000 / tree / year, unlimited
  downloads of any size while `Tree.keeperUntil` is in the future.
- **Deep search** (`PaymentKind.DEEP_SEARCH`) — KES 300 for one cross-tree
  lookup (`/discover`): is this person from my bloodline / clan? Free preview
  shows the match count; paid shows who, where, and a WhatsApp connect link.
- **Research Partner** (`PaymentKind.RESEARCH_PARTNER`) — quoted engagement
  (`/research` → `/admin/research`): we build the tree. Quote helper =
  `base + perGen × generationsTarget + perNode × nodesTarget`.

All prices/multipliers are editable in **/admin/settings**.

Credits detail:
first export per tree is **free**, then **1 credit per download**. Credits are
bought in bundles (`SINGLE` KES 750 · `BUNDLE_5` KES 2,500 · `BUNDLE_15`
KES 6,000, all editable). Flow: generate a **watermarked preview** free →
*Unlock* spends the free/credit, or moves to *awaiting payment* → buyer pays
the Till and pastes the M-Pesa code → admin approves at `/admin/payments` →
credits land → *Unlock* again → clean file at `/api/generations/[id]/download`.
Swap `PaymentSettings.provider` to an aggregator (IntaSend/Paystack STK push)
later — same `PaymentProvider` interface, webhook route already stubbed.

Health check: `GET /api/health` → `{ ok: true, db: "up" }`.

### Backups

`pg_dump` of the Postgres volume covers everything, **including uploaded media**
(it lives in the DB). Schedule it in Coolify; watch DB size as media grows.

---

## Project layout

```
src/app/(app)/…            authenticated app (dashboard, trees, admin)
src/app/s/[slug]/…         public shared views (phase 5)
src/app/api/…              health, auth, media, downloads, webhooks
src/lib/                   auth, rbac, db, queue, date/person helpers
src/lib/import/            .gramps + GEDCOM parsers → DB
src/lib/charts|generation/ chart layout + renderers (phase 6)
src/lib/payments/          pluggable payment providers (phase 6)
worker/                    pg-boss consumers (import, generation, email)
prisma/schema.prisma       full data model
_legacy/                   the original Gramps static HTML export (reference)
seed/family-compass.gramps original database, for importing
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `start` | Next.js dev / prod |
| `npm run worker` / `worker:dev` | pg-boss worker |
| `npm run db:migrate` | create a new migration (dev) |
| `npm run db:deploy` | apply migrations (prod) |
| `npm run db:seed` | seed global payment settings |
| `npm run db:studio` | Prisma Studio |
| `npm run typecheck` / `lint` | checks |
