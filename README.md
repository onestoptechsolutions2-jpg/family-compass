# Family Compass

A multi-tenant genealogy SaaS built around the Gramps data model.
Building and sharing a family tree is free; generating print-ready charts and
data exports costs **KES 750 per download**, paid by M-Pesa.

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
| 5 | Email invitations + accept flow, role management, `/trees/…/sharing`, public `/s/[slug]` read-only tree with living-person redaction + optional password/expiry, `/updates` activity feed | ✅ done |
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
5. First deploy only: set `RUN_SEED_ON_MIGRATE=true` **or** run
   `npm run db:seed` once via a Coolify terminal to create the global
   `PaymentSettings` row, then sign in as an `ADMIN_EMAILS` user and set your
   M-Pesa Till / Store number in **/admin/settings**. Verify payments at
   **/admin/payments**.

### Accounts & sign-in

There is **no in-app registration form**. Sign-in doubles as sign-up: the
first successful sign-in creates the account and a personal workspace.

Who is allowed to sign in (unless `OPEN_SIGNUP=true`):

- addresses in `ADMIN_EMAILS` (also get the platform-admin role)
- anyone who already has an account
- anyone with a pending invitation (`/trees/<id>/sharing` → *Invite by email*)
- addresses / domains in `ALLOWED_SIGNUP_EMAILS` / `ALLOWED_SIGNUP_DOMAINS`

Everyone else is bounced to the login page with an "invite-only" message.
Method is **Google OAuth and/or an email magic link** (`EMAIL_SERVER` +
`EMAIL_FROM`) — no passwords.

### Monetization model (phase 6)

Free to build, invite, and publish shared links. Downloads cost credits:
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
