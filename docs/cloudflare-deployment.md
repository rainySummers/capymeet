# Cloudflare Deployment Guide

This guide explains how to deploy CapyMeet to Cloudflare, configure a D1 database, create the first admin account, initialize rooms and door-display devices, create booking links, and optionally enable email notifications.

## 1. Prerequisites

You need:

- A Cloudflare account.
- Node.js and npm installed locally.
- Project dependencies installed:

```bash
npm install
```

Sign in to Cloudflare:

```bash
npx wrangler login
```

Confirm tests and production build work locally:

```bash
npm test
npm run build
```

## 2. Create A Cloudflare D1 Database

Create the production database:

```bash
npx wrangler d1 create capymeet
```

The command prints output similar to:

```text
[[d1_databases]]
binding = "DB"
database_name = "capymeet"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the example Wrangler config and paste the returned `database_id` into your local `wrangler.toml`:

```bash
cp wrangler.example.toml wrangler.toml
```

```toml
[[d1_databases]]
binding = "DB"
database_name = "capymeet"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

`wrangler.toml` contains real environment configuration and should not be committed. The repository keeps only `wrangler.example.toml`.

Test migrations locally:

```bash
npm run db:migrate:local
```

Apply migrations to the remote D1 database:

```bash
npm run db:migrate:remote
```

## 3. Create A Cloudflare Pages Project

Build the frontend:

```bash
npm run build
```

Create and deploy the Pages project:

```bash
npx wrangler pages project create capymeet --production-branch=main
npx wrangler pages deploy dist --project-name capymeet
```

After deployment, Cloudflare returns a Pages URL such as:

```text
https://your-project.pages.dev
```

Use this URL later as `PUBLIC_BASE_URL`.

## 4. Configure Environment Variables And Secrets

Required configuration:

- `JWT_SECRET`: admin login token secret, at least 32 characters.
- `PUBLIC_BASE_URL`: deployed app URL.
- `EMAIL_API_KEY`: optional email provider API key.
- `EMAIL_FROM`: optional sender address.

Generate an example `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Example values:

```text
JWT_SECRET=<generated-jwt-secret>
PUBLIC_BASE_URL=https://your-project.pages.dev
```

Recommended Cloudflare Dashboard setup:

1. Open the Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Select the `capymeet` Pages project.
4. Open Settings.
5. Find Environment variables.
6. Add Production variables.

You can also set secrets with Wrangler:

```bash
npx wrangler pages secret put JWT_SECRET --project-name capymeet
npx wrangler pages secret put EMAIL_API_KEY --project-name capymeet
```

`PUBLIC_BASE_URL` and `EMAIL_FROM` are not strong secrets and can be configured as regular environment variables in the Dashboard.

Redeploy after configuration:

```bash
npm run build
npx wrangler pages deploy dist --project-name capymeet
```

## 5. Configure The D1 Binding

Confirm the D1 binding name in `wrangler.toml` is:

```toml
binding = "DB"
```

The code also expects `DB`. Do not rename it unless you update the code too.

If configuring D1 from the Cloudflare Dashboard:

1. Open the Pages project.
2. Open Settings.
3. Open Functions.
4. Find D1 database bindings.
5. Add a binding:
   - Variable name: `DB`
   - D1 database: `capymeet`

## 6. Initialize The First Admin Account

The current version does not include an anonymous admin creation page. Insert the first admin account manually.

Generate a password hash:

```bash
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.argv[1], 12));" "<temporary-admin-password>"
```

Example output:

```text
$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Insert the admin into remote D1:

```bash
npx wrangler d1 execute capymeet --remote --command "
INSERT INTO admins (id, email, name, password_hash, is_enabled, created_at, updated_at)
VALUES (
  'admin-1',
  'admin@your-domain.example',
  'Admin',
  '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  1,
  datetime('now'),
  datetime('now')
);
"
```

Then open:

```text
https://your-project.pages.dev/admin/login
```

Use:

```text
Email: admin@your-domain.example
Password: <temporary-admin-password>
```

Use a strong production password.

## 7. Initialize A Room

Insert an example room:

```bash
npx wrangler d1 execute capymeet --remote --command "
INSERT INTO rooms (
  id,
  name,
  location,
  capacity,
  equipment_notes,
  is_enabled,
  opening_hours,
  min_duration_minutes,
  max_duration_minutes,
  max_advance_days,
  requires_approval,
  created_at,
  updated_at
) VALUES (
  'room-1',
  'Main Meeting Room',
  '2F',
  12,
  'TV, whiteboard, video conferencing',
  1,
  '{\"days\":[1,2,3,4,5],\"start\":\"09:00\",\"end\":\"18:00\"}',
  30,
  240,
  30,
  0,
  datetime('now'),
  datetime('now')
);
"
```

Field notes:

- `requires_approval = 0`: bookings are confirmed automatically.
- `requires_approval = 1`: bookings become pending approval and occupy the time slot.
- `min_duration_minutes` / `max_duration_minutes`: minimum and maximum booking duration.

## 8. Initialize A Door-Display Device

Create a device code for the door-display tablet:

```bash
npx wrangler d1 execute capymeet --remote --command "
INSERT INTO devices (
  id,
  device_code,
  name,
  default_room_id,
  is_enabled,
  created_at,
  updated_at
) VALUES (
  'device-1',
  'PAD-ROOM-1',
  'Main Meeting Room Door Display',
  'room-1',
  1,
  datetime('now'),
  datetime('now')
);
"
```

Door-display URL:

```text
https://your-project.pages.dev/pad/PAD-ROOM-1
```

## 9. Create Booking Links And QR Codes

After signing in as an admin, open:

```text
https://your-project.pages.dev/admin/links
```

Click `Create global link` to create a global booking link.

You can also call the API directly:

```bash
curl -X POST "https://your-project.pages.dev/api/admin/links" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"global"}'
```

Example response:

```json
{
  "id": "link-id",
  "token": "abc123",
  "url": "https://your-project.pages.dev/book/abc123",
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

## 10. Where To Get An Email API Key

The current code uses Resend by default:

```ts
fetch("https://api.resend.com/emails", ...)
```

If you do not change the code, Resend is recommended.

### 10.1 Resend

Platform:

```text
https://resend.com
```

Setup steps:

1. Register and sign in to Resend.
2. Open Domains.
3. Add your sending domain, for example `example.com`.
4. Add SPF / DKIM / verification DNS records as instructed by Resend.
5. After the domain is verified, open API Keys.
6. Click Create API Key.
7. Copy the key that starts with `re_`.

Cloudflare environment variable example:

```text
EMAIL_API_KEY=<resend-api-key>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

Notes:

- The `EMAIL_FROM` domain must be verified in Resend.
- If using only Resend's test domain, recipients may be limited.

### 10.2 SendGrid

Platform:

```text
https://sendgrid.com
```

Where to create a key:

```text
Settings -> API Keys -> Create API Key
```

Example:

```text
EMAIL_API_KEY=<sendgrid-api-key>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

Note: the current code does not use the SendGrid API format. To use SendGrid, update `src/server/services/emailService.ts` to call `https://api.sendgrid.com/v3/mail/send` with the SendGrid request body.

### 10.3 Mailgun

Platform:

```text
https://www.mailgun.com
```

Where to find keys:

```text
Sending -> Domains -> select a domain -> API Keys / SMTP credentials
```

Example:

```text
EMAIL_API_KEY=<mailgun-api-key>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

Note: the current code does not use the Mailgun API format. Update `emailService.ts` before using Mailgun.

### 10.4 Postmark

Platform:

```text
https://postmarkapp.com
```

Where to find tokens:

```text
Servers -> select a Server -> API Tokens
```

Example:

```text
EMAIL_API_KEY=<postmark-server-token>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

Note: the current code does not use the Postmark API format. Update `emailService.ts` before using Postmark.

### 10.5 Cloudflare Email Routing

Cloudflare Email Routing mainly receives email and forwards it to your inbox. It is not a transactional email sending service that the current code can use directly.

If you want to stay entirely within the Cloudflare ecosystem for email sending, integrate a Cloudflare Workers-compatible email service or another third-party API.

## 11. Deployment Checklist

Before deployment, confirm:

- `npm test` passes.
- `npm run build` passes.
- Local `wrangler.toml` has the real D1 `database_id`, and it has not been committed.
- `npm run db:migrate:remote` has been run.
- The Pages project has a D1 binding named `DB`.
- `JWT_SECRET` is configured and at least 32 characters.
- `PUBLIC_BASE_URL` is configured.
- If email is needed, `EMAIL_API_KEY` and `EMAIL_FROM` are configured.
- At least one admin account has been initialized manually.
- At least one room has been initialized manually.
- If using a door display, the corresponding device code has been initialized.

## 12. Common Deployment Issues

### Admin login reports server configuration error

Usually `JWT_SECRET` is missing or shorter than 32 characters.

### Booking link generation fails

Check that `PUBLIC_BASE_URL` is configured. This value is used to generate `/book/<token>` links and QR codes.

### Pages open, but API requests fail

Check that Pages Functions are enabled and that `functions/api/[[path]].ts` is included in the deployed project.

### API cannot access D1

Check the D1 binding:

- The binding name must be `DB`.
- The Pages project must be bound to the correct D1 database.
- Remote migrations must have been applied.

### Email is not sent

Check in order:

1. The booking includes an email address.
2. `EMAIL_API_KEY` is configured.
3. `EMAIL_FROM` is configured.
4. The Resend domain is verified.
5. `EMAIL_FROM` uses the verified domain.
