# BEASON Telegram License System

Production-oriented Telegram + backend + dashboard starter for BEASON CBT license generation. The Telegram bot is only the trusted front end. Real license issuance stays on the backend through an isolated `generateBeasonLicense(...)` boundary so the existing signed-license architecture is preserved.

## What this includes

- Webhook-based Telegram bot with helper approval flow
- Secure backend services for helper management, key issuance, revocation, and audit logging
- Supabase SQL schema with Row Level Security
- Next.js admin dashboard starter with login, overview cards, helper table, license table, CSV export, and detail pages
- Abstract BEASON issuer adapter so you can connect your existing signing service without exposing private keys

## Stack

- Next.js 15 + TypeScript
- Supabase Postgres
- Telegram Bot API via webhook route
- Server-side service-role backend access only

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file and fill secrets:

```bash
cp .env.example .env.local
```

3. In Supabase SQL editor, run:

```sql
-- File: sql/schema.sql
```

4. Configure your Telegram bot webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" ^
  -d "url=https://your-domain.com/api/telegram/webhook" ^
  -d "secret_token=<YOUR_TELEGRAM_WEBHOOK_SECRET>"
```

5. Start locally:

```bash
npm run dev
```

## BEASON issuer integration

This project intentionally does not implement or fake your private BEASON signing logic.

- Keep your real signing flow behind [`generateBeasonLicense(...)` in `lib/beason/issuer.ts`](/C:/Users/Gm_Bi/Documents/beason-bot/lib/beason/issuer.ts).
- Replace the internals of [`lib/beason/http-issuer.ts`](/C:/Users/Gm_Bi/Documents/beason-bot/lib/beason/http-issuer.ts) if your existing issuer already exposes a secure API.
- Or swap the implementation in [`lib/beason/issuer.ts`](/C:/Users/Gm_Bi/Documents/beason-bot/lib/beason/issuer.ts) to call your internal service or module.
- The private signing key must remain server-side only.

The backend expects the issuer to return:

- `keyCode`
- `signedPayload`
- `expiresAt`

## Telegram flows

- Helper taps `/start`
- Pending helper requests access
- Super admin receives approval buttons
- Approved helper chooses key type, duration, enters HWID, and confirms
- Backend validates role and approval, requests issuance from BEASON adapter, stores metadata, logs audit trail, and notifies super admin

## Dashboard auth

The starter uses simple credential login with signed cookies via `ADMIN_USERNAME` and `ADMIN_PASSWORD`. You can replace this with Supabase Auth later without changing the dashboard pages.

## Important notes

- All writes happen on the server using service-role access
- Helpers never write raw keys directly to Supabase
- Every approval, suspension, generation, revocation, and failed attempt is logged
- Activation syncing is prepared through the `activations` table and can be connected later from the BEASON app

## Project structure

```text
app/
  api/
  dashboard/
  login/
components/
lib/
  auth/
  beason/
  services/
  supabase/
  telegram/
sql/
```
