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
| 6 | Paid chart/export generation + manual M-Pesa Till payment + admin verification | ⏳ planned |
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
2. Set environment variables in the Coolify UI:

   | Variable | Notes |
   |---|---|
   | `AUTH_SECRET` | `openssl rand -base64 33` |
   | `AUTH_URL` / `APP_URL` | your public `https://…` origin |
   | `POSTGRES_PASSWORD` | strong value |
   | `DATABASE_URL` | `postgresql://familycompass:<pw>@postgres:5432/familycompass?schema=public` |
   | `GOOGLE_CLIENT_ID` / `_SECRET` | optional |
   | `EMAIL_SERVER` / `EMAIL_FROM` | optional (magic-link + notifications) |
   | `ADMIN_EMAILS` | comma-separated |

3. Attach your domain to the **`app`** service, port **3000**.
4. Deploy. On boot the `app` container runs `prisma migrate deploy`
   (`RUN_MIGRATIONS=true`); the `worker` container has it disabled to avoid a
   migration race.
5. First deploy only: set `RUN_SEED_ON_MIGRATE=true` **or** run
   `npm run db:seed` once via a Coolify terminal to create the global
   `PaymentSettings` row, then configure your M-Pesa Till in **/admin/settings**
   (phase 6).

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
