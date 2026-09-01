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
| 4 | Media upload (Postgres bytea) + `sharp` thumbnails + `/api/media/[id]` with auth, ETag, range · gallery + per-person photos · 10 MB/file, 250 MB/tree quota. Generated charts / PDFs live in `GeneratedFile` (TTL, no quota) and are excluded from the gallery. | ✅ done |
| 5 | Role management + `/trees/…/sharing`, public `/s/[slug]` read-only tree (living-person redaction, optional password/expiry), `/updates` feed. **WhatsApp self-onboarding**: claim an existing node from a shared view → admin approves in `/trees/…/claims` → one-tap `wa.me` sign-in link (`/api/auth/wa/[token]`). No email/passwords required. | ✅ done |
| 6 | Paid generation — watermarked preview → first-free / credit / M-Pesa Till bundle → admin verify → clean download. Pedigree/fan/descendant PDF, family-book PDF, GEDCOM + `.gramps` exports. Pluggable payment provider + `/admin/payments` + `/admin/settings` | ✅ done |
| 7 | Marketing pages, rate limiting, audit log, backups, admin console | 🟡 mostly done — `/admin` (users/revenue), `/admin/trees` (every tree, searchable), `/admin/payments`, `/admin/research`, `/admin/system` (resources · **Jobs**: pending worker queue + generations + imports with retry · maintenance · backup · audit log). Marketing pages + rate limiting still light. |
| L | **Lineage & naming** — `Tree.clanInheritance` (patrilineal default) + `inheritSurname`: adding a child/parent fills blank clan/sub-clan/surname from the lineage parent; correcting a person's clan **cascades down the line** (`cascadeClanDown`, stops at a daughter's children). `Person.namedAfterId` records the relative a child is named after; add-child dialogs suggest the four grandparents. Settings → Clan & naming has a bulk **backfill**. | ✅ done |
| M | **Memorial Pass** — one KES 1,500 payment per memorial unlocks unlimited clean memorial-book & programme prints for `memorialPassDays`. `Memorial.passUntil`, `Payment.memorialId`, wired through `fulfilPayment` + `unlockGeneration` + the bereavement checklist. | ✅ done |
| R | **Relationships as shared history** — `Memory` / `MemoryParticipant` (co-owned, each side annotates), `RelationEdge` (derived closeness score, never a slider; carries the origin story — text + context + "through" person), `RelationAssertion` (per-side, so reciprocity is measurable). Person-page **Circle** tab; **Family energy** bar on Reports (tree-wide + per household); `GET /api/v1/trees/{id}/relationships`; `memory.added` / `relation.named` webhooks. | 🟡 in progress |
| R2 | **Friend links** — invite a non-relative → they get their own seeded tree and a cross-tree `FriendLink` joins the two people (`/f/<token>`, WhatsApp sign-in, no email). "From other families" on the Circle tab; `GET /api/v1/trees/{id}/friend-links`; `friend.invited` / `friend.linked` webhooks. | 🟡 in progress |
| R3 | **Profile analyzer** — `analyzeProfile()` finds the gaps (birth, place, photo, clan, then parents → grandparents → great-grandparents) and a persistent `<ProfileGaps>` wizard on the person page works toward four generations (present vs a 14-ancestor target). | 🟡 in progress |
| R4 | **Device notifications** — opt-in Web Push (`web-push` + VAPID, `public/sw.js`), `PushSubscription` + `User.notifyPrefs`. `<PushSetup>` in the claimed-profile wizard and on `/account` with a per-category mute form. Off until `VAPID_*` is set. | 🟡 in progress |
| R5 | **Your profile is home** — `homePathForUser()` routes every sign-in (WhatsApp link, magic link, "Open app") to the claimed person's own profile; the tree view centres on them by default. Public landing carousel of the largest directory trees (`publicShowcase()` — aggregate counts only). Entity pickers are type-ahead (`<SearchSelect>`), with "＋ Add …" inline person-create in the family forms. | 🟡 in progress |

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

1. **New Resource → Docker Compose**, point it at this repo. Set **Base
   Directory** = `/` and **Docker Compose Location** = `/docker-compose.yml`
   — must match the filename exactly. A mismatch fails the deploy in seconds
   with *"Docker Compose file not found at: …"*. Set it once and leave it.
2. Set environment variables in the Coolify UI. The compose file **refuses to
   start** without the required ones. **Turn "Build Variable" OFF for every
   secret** (`AUTH_SECRET`, `DATABASE_URL`, `POSTGRES_PASSWORD`,
   `SUPERADMIN_PASSWORD`, `GOOGLE_CLIENT_SECRET`, `MPESA_*`) — otherwise Coolify
   passes them as Docker build args, which bake them into image layers and
   print them in the build log. They're only needed at runtime; the Dockerfile
   has harmless dummy defaults for the build.

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
   | `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` | — | Web Push for installed apps; `npx web-push generate-vapid-keys`. Unset = device notifications disabled. `VAPID_SUBJECT` optional (defaults to `mailto:<ADMIN_EMAILS[0]>`). |
   | `RUN_SEED_ON_MIGRATE` | — | `true` on the very first deploy only |

3. Attach your domain (e.g. `myroots.laitor.co.ke`) to the **`app`** service.
   Coolify's proxy routes it to the container's `$PORT`; `APP_PORT` is the
   host-published port if you front it yourself.
4. Deploy. On boot the `app` container runs `prisma migrate deploy` — from
   `docker-entrypoint.sh` (`RUN_MIGRATIONS=true`) **and** again from the `npm`
   `prestart` hook, so migrations still apply if a platform "start command"
   bypasses the entrypoint. The `worker` container sets `RUN_MIGRATIONS=false`
   to avoid a race. If tree pages 500 on missing columns after a deploy, check
   `GET /api/health` — `pending[]` non-empty means migrations didn't run
   (usually a wrong **Docker Compose Location** / **Base Directory** in Coolify,
   or a start-command override); `failed[]` non-empty means one half-applied
   and needs `prisma migrate resolve`.
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
- **Memorial Pass** (`PaymentKind.MEMORIAL_PASS`) — KES 1,500, one payment per
  memorial: unlimited clean (no-watermark) memorial-book & funeral-programme
  prints for `memorialPassDays` (default 120) while `Memorial.passUntil` is in
  the future. Bought from the memorial editor; regenerate freely as
  arrangements change before a funeral.
- **Deep search** (`PaymentKind.DEEP_SEARCH`) — KES 300 for one cross-tree
  lookup. Launched as an **overlay** (`<DeepSearchDialog>`) from the
  relationship check or any person page, not a page of its own. The free
  preview is a **teaser** — given name + surname initial, clan, birth decade,
  area — enough to recognise a relative; paying reveals full names, which tree
  each is in, and a WhatsApp connect link.
- **Research Partner** (`PaymentKind.RESEARCH_PARTNER`) — quoted engagement
  (`/research` → `/admin/research`): we build the tree. Quote helper =
  `base + perGen × generationsTarget + perNode × nodesTarget`.

All prices/multipliers (including `memorialPassKes` / `memorialPassDays`) are
editable in **/admin/settings**.

Credits detail:
first export per tree is **free**, then **1 credit per download**. Credits are
bought in bundles (`SINGLE` KES 750 · `BUNDLE_5` KES 2,500 · `BUNDLE_15`
KES 6,000, all editable). Flow: generate a **watermarked preview** free →
*Unlock* spends the free/credit, or moves to *awaiting payment* → buyer pays
the Till and pastes the M-Pesa code → admin approves at `/admin/payments` →
credits land → *Unlock* again → clean file at `/api/generations/[id]/download`.
Swap `PaymentSettings.provider` to an aggregator (IntaSend/Paystack STK push)
later — same `PaymentProvider` interface, webhook route already stubbed.

Health & deploy probe: `GET /api/health` →
`{ ok, build, db, schemaUpToDate, appliedCount, pending[], failed[], latestApplied, latestOnDisk }`.
`build` is the commit the image was built from (`APP_BUILD_SHA`, stamped from
Coolify's `SOURCE_COMMIT`); `pending` / `failed` list migrations the connected
database hasn't applied. It stays **HTTP 200 while the DB is reachable** so a
migration lag can't make the container healthcheck flap or trigger a rollback —
read the body to see drift.

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
| `npm test` / `test:watch` | vitest |
| `npm run storybook` | component workshop at http://localhost:6006 |
| `npm run build-storybook` | static Storybook → `storybook-static/` |

## UI conventions

- **Overlays over pages.** Create / edit flows open in `<Dialog>` (`src/components/Dialog.tsx`)
  rather than a dedicated route where practical. `<ActionMenu>` groups per-row actions.
- **Tabs over long pages.** Config screens with many sections use `<Tabs>`
  (`src/components/Tabs.tsx`) — accessible, arrow-key nav, the active tab is kept in the URL hash.
  The memorial editor is the reference (Content / Service / People helping / Tributes & fund).
- **Search, not scroll.** Pick a person / place / clan / family with `<SearchSelect>`
  (`src/components/SearchSelect.tsx`) — a type-ahead that submits like a native control. With
  `allowCreate` a "＋ Add …" row submits `new:<name>` for the server action to create (see
  `resolvePersonRef` in the families actions). `<PersonSelect>` wraps it. Small fixed enums stay
  as `<select>`.
- **Design tokens.** Colours come from CSS variables (`--surface`, `--accent`, `--muted`, …); never
  hard-code hex. Stories live next to components as `*.stories.tsx`.

## Plugins

- **Chama** (`src/lib/chama/plugin.ts`) — family welfare funds on memorials + linking an external
  [Chama-platform](https://chama.laitor.co.ke) group via its Developer API. Independent app; the
  only shared concerns are payments and communication. Disable entirely with `CHAMA_ENABLED=false`.
