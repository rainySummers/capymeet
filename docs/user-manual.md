# CapyMeet User Manual

This guide explains how to use CapyMeet as an admin, a booking user, or a meeting-room door-display operator.

## 1. System Overview

CapyMeet manages meeting room bookings, door-display tablet status, admin configuration, approval workflows, booking links, and optional email notifications. It keeps its own booking data and does not depend on Google Calendar, Outlook, or another external calendar system.

Main entry points:

- Public booking page `/`: users can view rooms and submit bookings without signing in.
- Booking link `/book/<token>`: a public entry point created by an admin. It can be global or room-specific.
- Door display `/pad/<deviceCode>`: shows current room status, today's schedule, and a QR code for booking.
- Admin console `/admin/login`: admins manage rooms, devices, bookings, approvals, links, email, and accounts.
- Cancellation notice `/cancel`: self-service cancellation is not available in the current version. Users should contact an admin.

## 2. Booking A Meeting

Users can open the public booking page or scan a booking QR code, then follow this flow:

1. Select a room.
2. Select a date, start time, and end time.
3. Review room rules, opening hours, and existing bookings.
4. Enter the meeting title, contact name, and email.
5. Submit the booking.

The system checks that the room is enabled, the requested time is within opening hours, the duration follows the room rules, and the time does not conflict with existing confirmed or pending bookings. If the room requires approval, the booking becomes pending approval. Otherwise, it is confirmed immediately.

## 3. Changing Or Cancelling A Booking

Self-service booking cancellation has been removed in the current version. Users who need to change or cancel a booking should contact an admin.

Admins can use the Bookings page to review bookings, then cancel or delete bookings when needed. Cancelled bookings no longer occupy room time.

## 4. Door Display

Door display URLs use this format:

```text
/pad/<deviceCode>
```

`<deviceCode>` is created by an admin in the Devices section.

The door display shows:

- The bound or selected room.
- Whether the room is currently available.
- The current meeting, host, and time range.
- Upcoming confirmed bookings for the day.
- A QR code that opens the current room's booking page.

The page refreshes time and schedule data every 10 seconds and reports device heartbeat to the backend. Pending approvals do not appear on the door display. If the device code does not exist, the device is disabled, or the network is unavailable, the page shows an error.

For on-site use, mount the tablet outside the room, keep Wi-Fi stable, use continuous power, and disable auto-lock or use kiosk / single-app mode.

## 5. Admin Console

Admin login page:

```text
/admin/login
```

After signing in with email and password, the admin token is stored in the browser and the admin console opens.

Main admin modules:

| Module | Purpose |
| --- | --- |
| Dashboard | View current room status, today's bookings, pending approval count, and upcoming meetings |
| Rooms | Create, edit, enable, or disable rooms, and configure opening hours, buffer time, booking duration, and approval rules |
| Devices | Create and maintain door-display devices, including device code, device name, default room, and enabled state |
| Bookings | View, filter, manually create, cancel, or delete bookings |
| Approvals | Review pending bookings. Approval rechecks conflicts before confirming |
| Links & QR | Create global or room-specific booking links and view QR codes |
| Email | Toggle email notifications, edit email subject and reply instructions, and send test email |
| Admins | Create admin accounts, enable or disable accounts, edit names, or reset passwords |

## 6. Booking Links And QR Codes

Admins can open `/admin/links` to create two kinds of booking links:

- Global booking link: users choose a room after opening the link.
- Room-specific booking link: users open a link that starts with a specific room.

Each link includes a URL and QR code. QR codes are useful on room doors, internal web pages, and event notices. Disable or delete links that are no longer used.

## 7. Email Notifications

Email notifications are optional.

Email is sent only when all of these conditions are met:

- The booking includes an email address.
- Email provider environment variables are configured.
- Email notifications are enabled in the admin Email settings.

Supported environment variables:

- `RESEND_API_KEY` or `EMAIL_API_KEY`
- `EMAIL_FROM`

Email delivery failures do not block booking, approval, or cancellation operations. Admins can send a test email from the Email page to verify the current configuration.

## 8. Deployment And Runtime Configuration

CapyMeet is designed for Cloudflare deployment:

- Cloudflare Pages: frontend pages.
- Cloudflare Pages Functions: API.
- Cloudflare D1: database.

Required configuration:

- `DB`: Cloudflare D1 binding.
- `JWT_SECRET`: admin login token secret, at least 32 characters.
- `PUBLIC_BASE_URL`: public app URL used to generate booking links and QR codes.

Common local commands:

```bash
npm install
npm test
npm run build
cp wrangler.example.toml wrangler.toml
npm run db:migrate:local
```

`wrangler.toml` contains real local or deployment environment configuration and should not be committed.

## 9. Current Limitations

- No external calendar integration.
- No SMS verification.
- No user-facing self-service booking cancellation or editing page.
- Email delivery depends on third-party email provider configuration.
- The first admin account must be inserted into D1 manually after deployment.

## 10. FAQ

### Why does booking report a conflict?

For the same room, any `confirmed` or `pending_approval` booking that overlaps the selected time will block the new booking. Room buffer time is also included in conflict detection.

### Is email required for booking?

The current booking form requires an email address. Email notifications are sent only after the system is configured and notifications are enabled.

### Why does the door display not show a newly submitted booking?

The door display shows confirmed bookings only. Pending approvals are hidden. After a confirmed booking is created or changed, the door display may take up to the next 10-second refresh to update.

### Can a disabled admin keep using the console?

No. Protected admin APIs recheck whether the admin account is still enabled on every request.

### Do email failures affect bookings?

No. Email delivery failures do not block booking, approval, or cancellation state changes.
