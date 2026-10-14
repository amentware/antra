# Antra

**Antra** is a single-user, phone-first **expense tracker & budgeting PWA**. It is
offline-first (reads never touch the network), installs to the home screen, and
runs entirely on Cloudflare's free tier.

> Pay for things with a credit card, log them in seconds with a custom numeric
> keypad, and always know what's safe to spend this month.

- **Expenses + budgets only.** There is deliberately no income entry and no
  account balance tracking — Antra answers *"where did my money go and am I on
  track?"*, not *"how much do I have?"*.
- **Works offline.** Every read comes from an on-device IndexedDB (Dexie) cache;
  writes are applied locally first, then synced to Cloudflare in the background.
- **Installable.** A real PWA with a manifest, iOS splash screens, maskable
  icons, and a service worker (precache + runtime caching).
- **Locked down.** One account, server-side registration lock after the first
  user, PBKDF2 password hashing, signed `HttpOnly` session cookies, optional
  local PIN lock, hashed revocable API tokens.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Database & secrets](#database--secrets)
- [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
- [First run](#first-run)
- [Install as an app (PWA)](#install-as-an-app-pwa)
- [Public API (v1)](#public-api-v1)
- [iOS Shortcuts](#ios-shortcuts)
- [How sync works](#how-sync-works)
- [Data model](#data-model)
- [Testing](#testing)
- [Scripts](#scripts)
- [Architecture & design notes](#architecture--design-notes)
- [Sensible defaults](#sensible-defaults)
- [Security notes](#security-notes)
- [Not included (on purpose)](#not-included-on-purpose)

---

## Features

### Track
- Add an expense in seconds: amount → category → account → optional merchant /
  note / date → Save. A **custom numeric keypad** (1–9, `.`, 0, backspace, and
  `+ − × ÷ =`) means `250+80` is computed inline and the native keyboard never
  appears for amounts.
- **Accounts**: bank or credit card. Cards add a credit limit, statement day and
  due day.
- **Credit cards**: mark paid/unpaid, one-tap toggle, and a per-card **Pay bill**
  bulk action. Bank expenses are always paid. See outstanding amount,
  utilization %, next due date and days remaining.
- **13 default categories** (Food & Dining, Groceries, Rent, Transport, Fuel,
  Shopping, Bills & Utilities, Entertainment, Health, Travel, Education,
  Subscriptions, Other) — plus create / edit / delete / reorder with a name,
  emoji and colour.
- **Transactions**: grouped by day, search, and filters (category, account, paid,
  date range, amount range); swipe to delete with an **Undo** toast; a detail
  screen to edit anything.

### Understand
- **Insights** with a Daily/Monthly toggle and Week/Year ranges: totals vs the
  previous period, daily average, count, largest expense, most frequent merchant,
  a cumulative trend chart (with last-month overlay), a category donut and ranked
  list, a **calendar heatmap**, day-of-week and time-of-day distributions, top
  merchants, spend by account, and a projected month-end.
- **Budgets** per category per month: spent / limit / remaining / % used, status
  (**Safe**, **Warning ≥ 80%**, **Over**), daily *safe-to-spend*, pace vs the
  calendar, an overall summary, and colour-graded progress bars.
- **Local alerts**: a one-time toast when a category crosses 80% or 100%.
- A rule-based **insight banner** on Home ("You may exceed your Dining budget by
  ₹420 this month.") — 100% local, no external AI.

### Delight
- Light theme by default, refined dark theme, follows the system or your choice.
- iOS-style page transitions, spring bottom sheets, staggered list animations,
  count-up numbers, animated progress bars and charts, spring press feedback,
  haptics (`navigator.vibrate`), and `prefers-reduced-motion` support.
- Phone-only by design: on screens wider than 480px the app renders inside a
  centred ~430px phone frame.

---

## Tech stack

| Layer      | Choice |
| ---------- | ------ |
| UI         | React 18 + TypeScript + Vite |
| Styling    | Tailwind CSS |
| Motion     | Framer Motion (+ View Transitions API where available) |
| Routing    | React Router |
| State      | Zustand (UI/session/sync/toast) |
| Local data | Dexie (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`) |
| Charts     | Recharts (lazy-loaded) |
| PWA        | `vite-plugin-pwa` / Workbox |
| Dates      | `date-fns` |
| Validation | Zod (shared client ⇄ server schemas) |
| Backend    | Cloudflare Pages Functions + Hono |
| Database   | Cloudflare D1 (SQLite) |
| Tests      | Vitest |

All money is stored as **integer minor units** (paise/cents) and formatted for
display with `Intl.NumberFormat` — no floating-point money, ever.

---

## Project structure

```
antra/
├─ src/                      # React app (the PWA)
│  ├─ components/            #   UI primitives, sheets, charts, keypads
│  ├─ screens/               #   Home, Insights, Transactions, Budgets, …
│  ├─ hooks/                 #   live Dexie queries, preferences, app lock, alerts
│  ├─ lib/                   #   db, api client, sync engine, repo, stats, format…
│  ├─ store/                 #   Zustand stores
│  └─ App.tsx / main.tsx
├─ shared/                   # Code shared by app + worker (pure, no DOM/DB)
│  ├─ money.ts, budget.ts, currency.ts, match.ts, sync.ts, schemas.ts, types.ts
├─ server/                   # Hono worker app (auth, sync, public API)
├─ functions/
│  └─ api/[[route]].ts       # Cloudflare Pages Functions entry → server/app
├─ migrations/               # D1 SQL migrations
├─ scripts/generate-icons.mjs# Icon + splash generator (pure Node, no deps)
├─ public/                   # Static assets: icons, splash, _headers, _redirects
├─ tests/                    # Vitest unit tests
├─ wrangler.toml             # Pages + D1 binding config
└─ vite.config.ts / vitest.config.ts
```

---

## Prerequisites

- **Node.js 20+** and npm
- A **Cloudflare account** (the free plan is enough)
- `wrangler` is installed locally as a dev dependency (use `npx wrangler …`)

```bash
npm install
```

---

## Local development

Antra's API runs on Cloudflare's local runtime (Miniflare) via Wrangler, while
Vite serves the UI with hot-reload. Vite proxies `/api/*` to Wrangler on port
`8788`.

1. **Create your local env file** (see [Database & secrets](#database--secrets)):

   ```bash
   cp .dev.vars.example .dev.vars
   # then edit .dev.vars and set JWT_SECRET to a long random string
   ```

2. **Apply the database migration** to the local D1 instance:

   ```bash
   npm run db:migrate:local
   ```

3. **Run the API** (Terminal A). This serves the built static assets and the
   functions on <http://127.0.0.1:8788>:

   ```bash
   npm run build      # required once so dist/ exists
   npm run dev:api
   ```

4. **Run the UI with HMR** (Terminal B):

   ```bash
   npm run dev        # http://localhost:5173
   ```

Open <http://localhost:5173> and create your account. Requests to `/api/*` are
proxied to the local Worker, so auth, sync and the public API all work locally.

> Tip: after changing backend code, Wrangler hot-reloads; after changing static
> assets referenced by the worker, re-run `npm run build`.

---

## Database & secrets

### D1 database

Create the database once, then paste the printed `database_id` into
`wrangler.toml`:

```bash
npx wrangler d1 create antra-db
```

```toml
[[d1_databases]]
binding = "DB"
database_name = "antra-db"
database_id = "PASTE_YOUR_ID_HERE"
```

Apply migrations:

```bash
npm run db:migrate:local     # local dev database (.wrangler/state)
npm run db:migrate:remote    # production database
```

### `JWT_SECRET`

The Worker signs session cookies with HMAC-SHA256 using `JWT_SECRET`.

- **Local**: put it in `.dev.vars` (never committed).
- **Production**: store it as a Pages secret:

  ```bash
  npx wrangler pages secret put JWT_SECRET
  ```

  (Create the Pages project first — see below.)

### Optional KV (global login rate limiting)

By default login rate limiting works without any extra binding (D1-backed, per
isolate). If you want a single global bucket, create a KV namespace and uncomment
the `[[kv_namespaces]]` block in `wrangler.toml`:

```bash
npx wrangler kv namespace create RATE_LIMIT
```

---

## Deploy to Cloudflare Pages

### Option A — Wrangler CLI (fastest)

```bash
# 1. Create the Pages project (once).
npx wrangler pages project create antra

# 2. Create + migrate the D1 database (once).
npx wrangler d1 create antra-db            # paste id into wrangler.toml
npm run db:migrate:remote

# 3. Set the secret (once).
npx wrangler pages secret put JWT_SECRET

# 4. Build and deploy.
npm run cf:deploy                          # = npm run build && wrangler pages deploy dist
```

The app will be live at `https://<project>.pages.dev`.

### Option B — Git integration (auto-deploy on push)

In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to
Git**, then:

| Setting | Value |
| ------- | ----- |
| Framework preset | None (or Vite) |
| Build command   | `npm run build` |
| Build output    | `dist` |
| Node version    | 20+ |

Then add:
- **D1 binding**: variable name `DB` → your `antra-db` database
- **Secret**: `JWT_SECRET`
- (optional) **KV binding**: `RATE_LIMIT`

`public/_headers` sets security headers (CSP, HSTS, `nosniff`, `DENY`, etc.) and
`public/_redirects` provides the SPA fallback. Both are handled automatically by
Pages.

---

## First run

1. Open the site and tap **Create your account** (email + password).
2. The server tunes **registration is disabled** the moment the first user
   exists — this is a single-user app.
3. On first sign-in the server seeds the **13 default categories** and your
   settings row, and the client performs one full pull into IndexedDB.
4. Add an account (Settings → Accounts), set a few monthly budgets, and start
   logging expenses with the **+** button.

### Install as an app (PWA)

- **iOS Safari**: Share → **Add to Home Screen**. Launch from the home screen for
  the full-screen, no-browser-chrome experience (safe-area insets are handled).
- **Android Chrome**: Menu → **Install app** / **Add to Home screen**.
- When a new version is deployed you'll see a subtle **"New version available"**
  toast with a **Refresh** action.

---

## Public API (v1)

Base URL: `https://<project>.pages.dev/api/v1`

Create tokens in **Settings → API tokens**. The plaintext token is shown **once**
and looks like `antra_<random-hex>`; only its hash and a short prefix are stored.

Authenticate with a bearer token:

```
Authorization: Bearer antra_xxxxxxxxxxxxxxxx
```

Rate limit: **120 requests / 60s** per token (plus a small per-isolate login
limiter of 8 / 15 min). CORS is enabled for `/api/v1/*`.

### `GET /api/v1/meta`

Returns your currency and the accounts/categories available for matching.

```bash
curl "https://<project>.pages.dev/api/v1/meta" \
  -H "Authorization: Bearer $ANTRA_TOKEN"
```

```json
{
  "currency": "INR",
  "accounts": [{ "id": "acc_…", "name": "HDFC Credit Card", "type": "credit_card", "last4": "4321" }],
  "categories": [{ "id": "c_food", "name": "Food & Dining", "emoji": "🍽️" }]
}
```

### `POST /api/v1/expenses`

`amount` is in **major units** (e.g. `250.50`) and is converted to minor units on
the server.

| Field | Type | Notes |
| ----- | ---- | ----- |
| `amount` | number \| string | **required**, `> 0`, major units |
| `category` | string | id **or** fuzzy name; falls back to `Other` |
| `account` | string | id **or** fuzzy name; **required to resolve** if you have accounts |
| `merchant` | string | optional, ≤ 80 chars |
| `note` | string | optional, ≤ 280 chars |
| `date` | string | optional ISO date/time; defaults to now |
| `paid` | boolean \| number | optional; defaults to `false` for cards, `true` for banks |
| `create_missing` | boolean | auto-create the category if it doesn't match |
| `idempotency_key` | string | optional; the `Idempotency-Key` header wins if both are set |

Returns the created expense plus today's and this month's totals and the category
budget status.

```bash
curl -X POST "https://<project>.pages.dev/api/v1/expenses" \
  -H "Authorization: Bearer $ANTRA_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 2026-03-01-swiggy-lunch" \
  -d '{
        "amount": 250.50,
        "category": "Food",
        "account": "HDFC Credit Card",
        "merchant": "Swiggy",
        "note": "lunch"
      }'
```

```json
{
  "expense": {
    "id": "exp_…",
    "amount_minor": 25050,
    "amount": 250.5,
    "category_id": "c_food",
    "account_id": "acc_…",
    "merchant": "Swiggy",
    "note": "lunch",
    "spent_at": "2026-03-01T07:21:00.000Z",
    "paid": false,
    "currency": "INR"
  },
  "idempotent_replay": false,
  "totals": { "today_minor": 25050, "month_minor": 1835000, "today": 250.5, "month": 18350, "currency": "INR" },
  "budget": {
    "category": "Food & Dining",
    "limit_minor": 800000,
    "spent_minor": 612000,
    "remaining_minor": 188000,
    "percent_used": 76.5,
    "status": "safe",
    "safe_to_spend_minor": 13428,
    "days_left": 14,
    "projected_minor": 1265000,
    "currency": "INR"
  }
}
```

Repeating the same `Idempotency-Key` returns the original expense with
`"idempotent_replay": true` and HTTP `200` (instead of `201`).

### `GET /api/v1/expenses?limit=20`

List your most recent expenses (joined with category/account names). `limit` is
clamped to 1–100.

```bash
curl "https://<project>.pages.dev/api/v1/expenses?limit=5" \
  -H "Authorization: Bearer $ANTRA_TOKEN"
```

### Errors

| Status | When |
| ------ | ---- |
| `400` | invalid payload, unknown account (response lists `valid_accounts`), `amount ≤ 0`, no accounts yet |
| `401` | missing/invalid/revoked token or session |
| `404` | unknown route |
| `429` | rate limited (`Retry-After` header set) |

Errors are JSON: `{ "error": "…", "details": { … } }`.

---

## iOS Shortcuts

Because Antra exposes a token API, you can log an expense from the iOS Share
Sheet, Siri, or a widget without opening the app.

1. **Settings → API tokens → Create token**, copy the `antra_…` value.
2. In the **Shortcuts** app, add **Get Contents of URL**:
   - **URL**: `https://<project>.pages.dev/api/v1/expenses`
   - **Method**: `POST`
   - **Headers**:
     - `Authorization` → `Bearer antra_…`
     - `Content-Type` → `application/json`
   - **Request Body**: JSON with `amount`, `category`, `account`, `merchant`.
3. (Optional) ask Siri for input and pass it into the body.

The exact steps, plus a ready-to-paste JSON body, are also shown in-app under
**Settings → Shortcuts setup**, and the app's token endpoints friendlily accept
**names** (e.g. `"food and dining"`, `"hdfc card"`) as well as ids.

> Tip: send an `Idempotency-Key` (Shortcuts → header) per event so retries never
> create duplicates.

---

## How sync works

Antra is **offline-first** with **last-write-wins**:

- **Reads never touch the network.** Every screen reads from Dexie via
  `useLiveQuery`, so the UI is instant and works with no connection.
- **Writes** are applied to Dexie immediately and queued in a persistent
  **outbox**, then pushed to Cloudflare right away. If the push fails the op
  stays queued and retries with backoff — on reconnect, on foreground, and on the
  next write.
- **Delta pull**: the client calls `GET /api/sync?since=<cursor>` on launch, on
  foreground (throttled to at most once per 60s), on reconnect, and on manual
  pull-to-refresh. The first login does one full pull.
- Rows carry `id`, `created_at`, `updated_at`, `deleted_at`. Deletes are
  **tombstones** so they propagate. Conflicts resolve by the newer `updated_at`.
- IDs are generated on the client, which makes every write idempotent. The push
  endpoint is a single batched call: `POST /api/sync { ops: [{ table, op, row }] }`.
- A subtle indicator shows **synced / syncing / offline (N pending)**.

---

## Data model

D1 tables are created by `migrations/0001_init.sql`:

| Table | Purpose | Key indexes |
| ----- | ------- | ----------- |
| `users` | the single account (email, PBKDF2 hash+salt) | `email` unique |
| `sessions` | server-side session records for cookie auth | `(user_id)`, `(expires_at)` |
| `api_tokens` | hashed, revocable bearer tokens | `(user_id)`, `token_hash` unique |
| `rate_limits` | D1-backed login rate limiting (when KV isn't bound) | `key` |
| `accounts` | bank / credit-card accounts | `(user_id, updated_at)`, `(user_id, deleted_at)` |
| `categories` | categories (name, emoji, colour, order) | `(user_id, updated_at)`, `(user_id, deleted_at)` |
| `expenses` | expenses (`amount_minor`, category, account, paid, source…) | `(user_id, updated_at)`, `(user_id, spent_at)`, `(user_id, category_id)`, `(user_id, account_id)`, unique `(user_id, idempotency_key)` |
| `budgets` | per-category monthly limits | `(user_id, updated_at)`, `(user_id, category_id)` |
| `settings` | currency / theme / timezone / week start | `user_id` unique |

Money is integer minor units; timestamps are UTC ISO-8601 strings; booleans are
`0`/`1`.

---

## Testing

Pure logic is unit-tested with Vitest, with no DOM or database required:
money + currency formatting, budget math, the analytics/selector layer the
screens use (`budgetRows`, `cardStats`, `rangeStats`, …), the delta-sync
last-write-wins rules, and the public API's fuzzy name matching.

```bash
npm test          # run once
npm run test:watch
```

Type-checking is split by target:

```bash
npm run typecheck           # app (src)
npm run typecheck:worker    # worker (server)
npm run typecheck:node      # config + scripts
npm run typecheck:test      # tests
```

The app build type-checks before bundling:

```bash
npm run build
```

---

## Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Vite dev server (HMR) on `:5173`, proxies `/api` → `:8788` |
| `npm run build` | Type-check the app, then `vite build` → `dist/` |
| `npm run preview` | Preview the built app |
| `npm run dev:api` | Local Wrangler Pages runtime (Functions + D1) on `:8788` |
| `npm run typecheck` / `typecheck:worker` / `typecheck:node` / `typecheck:test` | Type-check each target |
| `npm test` / `npm run test:watch` | Run unit tests |
| `npm run icons` | Regenerate icons + splash screens from the SVG source |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations to production |
| `npm run cf:deploy` | Build and deploy to Cloudflare Pages |

---

## Architecture & design notes

- **Shared logic lives in `shared/`** and is imported by both the React app
  (`@shared/*`) and the Worker (`../shared/*`). Money, budget math, currency
  metadata, fuzzy matching, the LWW sync rules and Zod schemas are all pure and
  dependency-free, so they're trivially testable.
- **The Worker is one Hono app** (`server/app.ts`) mounted by a catch-all Pages
  Function (`functions/api/[[route]].ts`). `/api/auth/*` handles setup/login and
  issues a signed, `HttpOnly; Secure; SameSite=Strict` session cookie (~30 days,
  rotated weekly). `/api/sync` handles batched push and delta pull. `/api/v1/*`
  is the token-authenticated public API.
- **JWT via WebCrypto** (HMAC-SHA256), no crypto dependency. Passwords use
  PBKDF2-SHA256 with a per-user salt; API tokens are SHA-256 hashed at rest.
- **Charts are lazy-loaded** so Recharts never blocks the app shell.
- **Icons and splash screens are generated** by a dependency-free Node script
  (`scripts/generate-icons.mjs`) that writes PNGs using `zlib` only.

---

## Sensible defaults

A few decisions were made where the spec left room; they're easy to change:

- **Timezone**: the app uses the **device** timezone for "today"/month
  boundaries; the public API uses `settings.timezone` (default
  `Asia/Kolkata`). Timestamps are always stored in UTC.
- **Week start**: **Monday** by default (configurable in Settings).
- **Default currency**: **INR**, with correct `en-IN` lakh grouping. Currency is
  display-only — Antra never converts between currencies.
- **Default account resolution**: API requests without an `account` use the
  first non-archived account; if an `account` is given but doesn't match, the
  request is rejected with the list of valid accounts.
- **Unknown categories** fall back to **Other** unless `create_missing: true`.
- **PIN lock**: off by default; when enabled it locks on cold start and after a
  configurable resume timeout (default 5 minutes).
- **Budget alerts**: on by default (80% and 100%), each firing at most once per
  category, per month. Toggle in Settings.
- **Delta-pull throttle**: foreground pulls are limited to once per 60 seconds.
- **Sync conflicts**: last-write-wins by `updated_at` (equal timestamps apply the
  remote row, which is idempotent).

---

## Security notes

- Single-user: registration is permanently disabled after the first account is
  created.
- Passwords: PBKDF2-SHA256, per-user random salt, stored as base64.
- Sessions: signed `HttpOnly; Secure; SameSite=Strict` cookie, validated against
  the `sessions` table on every authenticated request, rotated every 7 days.
- API tokens: shown once, stored only as SHA-256 hashes, revocable per token,
  with a short prefix for identification.
- All D1 queries are **parameterized**; every row is scoped by `user_id`.
- Login and public-API rate limiting are in place.
- Responses set a strict **Content-Security-Policy** plus HSTS, `nosniff`,
  `X-Frame-Options: DENY`, a restrictive `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, and `no-store` on `/api/*`.

---

## Not included (on purpose)

- No income, no account balances, no net-worth tracking.
- No multi-user / sharing / collaboration.
- No currency conversion.
- No external AI — insights are deterministic rules computed on-device.

---

## License

Private / personal project. Add a license here if you intend to share it.
