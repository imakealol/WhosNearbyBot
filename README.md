# WhosNearbyBot

A Telegram Mini App for finding nearby Telegram users — React + TypeScript SPA with a Cloudflare Worker backend and Supabase (PostgreSQL).

## Architecture

### Frontend (React SPA)
- **Stack:** React 19, TypeScript, Vite, Leaflet/react-leaflet
- **Deployed to:** GitHub Pages (via CI)
- **Config:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYMENT_WORKER_URL` set at build time (GitHub Actions secrets). See `.env.example`.

### Backend (Cloudflare Worker)
- **URL:** `https://teleclaw-dispatch.silent-flower-a7c2.workers.dev/287f310dcfbf`
- **Payment Worker:** `worker.js` — Telegram Stars invoice creation (`POST /create-invoice`), verified payment webhook (`POST /telegram-webhook`), `GET /health`.
- **Secrets (set via `wrangler secret` / hosting env — never commit):**
  - `TELEGRAM_BOT_TOKEN` — bot token for @WhosNearbyBot
  - `SUPABASE_URL` — Supabase project URL
  - `SUPABASE_ANON_KEY` — Supabase anon key

### Database (Supabase PostgreSQL)
- Migrations live in `supabase/migrations/` (run them in order in the Supabase SQL Editor):
  - `001_initial_schema.sql` — `profiles` (with subscription expiry columns), `transactions` (idempotency), `purchases`, RLS policies
  - `002_age_enforcement_and_nearby.sql` — `compute_age()` + trigger that recomputes `is_underage` from `dob` on every write (server-side 18+ gate), and `get_nearby_users()` Haversine search with server-side age filtering

## Men-Only Entry (gaymode)

The app supports a `startapp=gaymode` parameter that locks the user's gender to "man" and seeking to "men". This is used by @HKMODate_bot as a dedicated men-only entry point: `https://t.me/HKMODate_bot/app?startapp=gaymode`.

### Two Entry Points

| Entry | Bot | Link | Behavior |
|-------|-----|------|----------|
| Default (botB) | @WhosNearbyBot | standard web app link | gender/seeking freely selectable |
| Gay mode (botA) | @HKMODate_bot | `https://t.me/HKMODate_bot/app?startapp=gaymode` | gender locked to "man", seeking locked to "men" (selectors disabled) |

The chat menu button on @HKMODate_bot ("Open App") opens the Mini App; the app itself detects the entry via `start_param` (`gaymode` → botA, otherwise botB). The chat button label links to @HKMOChat in gaymode and @WhosNearby in default mode.

## Features

- 📍 Grid of nearby Telegram users sorted by distance (server-side Haversine)
- 🗺️ Map view with Leaflet (free OpenStreetMap tiles, no API key)
- 👤 Profile cards with age, zodiac sign, height, weight, distance, last seen
- 🔗 Click any user to open a DM via Telegram
- ⚡ Preference tag matching (role, safety, playstyle, group size, location)
- 🎛️ Filter menu (preference tags) — subscription-gated via Telegram Stars
- 🔒 Server-side age verification (18+), hide age toggle, invisible mode — via Stars payments
- 🌙 Dark theme

## Telegram Stars Payments

| Feature | Price | Type |
|---------|-------|------|
| Hide Age (30 days) | 1000 XTR | `hide_age` |
| Invisible Mode (30 days) | 3000 XTR | `invisible` |
| Edit Profile Pass | 1000 XTR | `edit_profile` |
| Filter Subscription (30 days) | 1000 XTR | `change_filter` |
| Change Profile & Preferences | 1000 XTR | `change_preference` |

**Payment flow:** Frontend calls `POST /create-invoice` → gets invoice link → opens via `Telegram.WebApp.openInvoice()` → Telegram sends webhook to `POST /telegram-webhook` → webhook verifies the charge via `getUpdates`, records it in `transactions` (idempotent), and updates the profile in Supabase.

## Development

```bash
npm install
npm run dev      # Vite dev server
npm run build    # Build for production
```

Copy `.env.example` to `.env` and fill in the values before building.
