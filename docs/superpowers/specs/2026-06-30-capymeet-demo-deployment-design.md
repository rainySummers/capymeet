# CapyMeet Demo Deployment Design

## Goal

Deploy a new Cloudflare demo environment named `capymeet-demo` without reusing the existing Pages address or database, and make the admin login page clearly warn visitors that this is a demo environment.

## Cloudflare Resources

- Cloudflare Pages project: `capymeet-demo`
- Cloudflare D1 database: `capymeet-demo`
- Cloudflare Worker: `capymeet-demo-cleanup`
- Worker schedule: `0 20 * * SUN`, which runs weekly at Sunday 20:00 UTC / Monday 04:00 Asia/Shanghai

The Pages project and cleanup Worker bind to the same D1 database with the binding name `DB`.

## Login Warning

The admin login page shows a modal dialog when opened. The dialog states that the site is for demo use only, must not be used as production, and that the database is cleaned once per week. The dialog is localized through the existing admin i18n dictionaries and can be dismissed before logging in.

## Weekly Cleanup

The cleanup Worker runs on a Cloudflare Cron Trigger. The cleanup removes demo business data while preserving admin accounts so the demo can still be accessed after each reset.

Cleaned tables:

- `audit_logs`
- `booking_links`
- `bookings`
- `devices`
- `rooms`
- `email_settings`
- `business_settings`

Preserved tables:

- `admins`

The order deletes child records before parent records to avoid foreign-key conflicts.

## Verification

Tests cover the login warning dialog and the cleanup SQL sequence. The production build must pass before deployment. After Cloudflare deployment, the resulting Pages URL and Worker deployment result are recorded for the user.
