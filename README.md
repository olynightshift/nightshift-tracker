# Olympia Downtown Nightshift — Data Tracker

React + Vite + Tailwind app with a Supabase Postgres backend, deployed to Vercel.
Tracks outreach nights, blanket salvage, donations, donor contacts, clothing-closet
visits, and receipts (with in-browser OCR scanning).

Live: https://tracker.olynightshift.org

## Local development

```bash
npm install
npm run dev
```

Requires `.env` (see `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Sign-in passcode

The app opens to a 6-digit passcode screen. The code **is** the password of one
shared volunteer account (`crew@olynightshift.org`, defined in
`src/components/AuthGate.jsx`). Signed-in sessions persist per device, so phones
with the app on their home screen stay logged in.

**To set or change the code:**

1. Supabase Dashboard → **Authentication → Users**
2. Find (or create) the user `crew@olynightshift.org`
3. Set its password to the desired 6 digits

## Database access control (important)

The login screen is only a door. The actual lock is **Row Level Security**.
Run the script in `supabase/migrations/0001_enable_rls.sql` once
(SQL Editor → New query → paste → Run) so only signed-in users can read or
write the tables. Safe to re-run.

## Deploy

Push to `main` on GitHub — Vercel builds and deploys automatically.

## Undo / redo

Every save, edit, and delete goes through an action history. Use the
Undo/Redo buttons in the sidebar (or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z).
Deletes always ask for confirmation first.

## Repo layout

- `src/lib/` — helpers, Supabase client, receipt OCR/parsing
- `src/api.js` — Supabase data access layer
- `src/tabs/` — one file per module (Dashboard, Outreach, Salvage, Donations, Contacts, Closet, Receipts)
- `src/components/` — modals, auth gate, undo/confirm/toast providers
- `archive/` — pre-restructure backup, kept for reference
