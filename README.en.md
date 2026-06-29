# CapyMeet

<p align="center">
  <a href="README.md">Simplified Chinese</a> | <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="src/client/assets/capymeet-logo.png" alt="CapyMeet Logo" width="200">
</p>

<p align="center">
  <strong>Meeting room booking, door display, and admin management for workplace spaces</strong>
</p>

## Overview

CapyMeet is a meeting room booking system for workplace spaces. It covers employee booking, meeting room door displays, admin operations, approval flows, QR booking links, and optional email notifications. It is suitable for internal meeting rooms, shared offices, training rooms, showroom meeting areas, and any environment that needs centralized room scheduling.

The system has three user-facing entry points:

| Entry point | Typical users | Purpose |
| --- | --- | --- |
| Public booking page `/`, `/book/:token` | Employees, visitors, internal event participants | View rooms, choose a time, and submit a booking |
| Door display `/pad/:deviceCode` | Tablets mounted outside meeting rooms | Show room status, today's schedule, and a booking QR code |
| Admin console `/admin` | Office admins, reception, IT, workplace managers | Manage rooms, devices, bookings, approvals, QR links, email, and admin accounts |

![CapyMeet overview: public booking, door display, and admin console working together](docs/images/capymeet-overview.png)

_CapyMeet uses a capybara visual theme to connect phone booking, door displays, and admin operations into one clear room management workflow._

## Features

### 1. Public Booking

The public booking page helps users submit room bookings quickly.

- Users can book from the homepage or from admin-generated booking links.
- Global booking links and room-specific booking links are supported.
- Users can view room details, available dates, opening hours, duration limits, and existing bookings.
- Booking forms collect meeting title, contact name, email, date, start time, and end time.
- Time conflicts and buffer-time conflicts are shown clearly before submission.
- Each room can auto-confirm bookings or require admin approval.
- Successful submissions become either confirmed bookings or pending approvals, depending on the room rule.

![Public booking flow: choose a room, select a time, enter an email, and confirm](docs/images/capymeet-public-booking.png)

_The public booking page works well for company portals, QR posters, and room-door scan flows. Users only need to choose a room and time, then submit the form._

### 2. Door Display

The door display is designed for tablets mounted outside meeting rooms. Its goal is to make room status obvious at a glance.

- Each tablet uses a unique device code, such as `/pad/boardroom-pad`.
- A tablet can be bound to a default room and will open that room automatically.
- Users can temporarily switch to another room; the display returns to the default room after idle time.
- The page shows whether the room is available, the current meeting, host, time range, and upcoming meetings for the day.
- Only confirmed bookings appear on the door display. Pending approvals are hidden.
- The display includes a QR code that opens the room-specific booking page.
- The tablet refreshes time and schedule data every 10 seconds and reports device heartbeat to the backend.

![Door display deployment: wall-mounted tablet, power, Wi-Fi, QR code, and always-on setup](docs/images/capymeet-pad-setup.png)

_The door display is built for on-site reliability: a fixed device, fixed room, stable network, continuous power, and a full-screen always-on browser mode._

### 3. Admin Console

The admin console is the control center for configuration and daily operations.

| Module | Capabilities |
| --- | --- |
| Dashboard | View current room status, today's bookings, pending approval count, and upcoming meetings |
| Rooms | Create, edit, enable, and disable rooms; configure capacity, location, equipment notes, opening hours, buffer time, minimum and maximum duration, advance booking window, and approval rules |
| Devices | Create and manage door-display devices, device codes, device names, default room bindings, and enabled state |
| Bookings | View bookings, filter by room, sort, manually create bookings, cancel bookings, or delete bookings |
| Approvals | Approve or reject pending bookings; approval rechecks conflicts before confirming |
| Links & QR | Create global and room-specific booking links, view QR codes, enable, disable, or delete old links |
| Email | Toggle email notifications, edit email subject and reply instructions, and send test emails |
| Admins | Create admin accounts, enable or disable accounts, edit names, and reset passwords |

![Admin console: rooms, devices, bookings, approvals, QR codes, and email settings in one place](docs/images/capymeet-admin-console.png)

_The admin console keeps room configuration, device binding, booking operations, and QR distribution in one place for office and IT teams._

### 4. Notifications And Audit

- Email notifications are optional and can be enabled after configuring a sender and Resend API key.
- Confirmed bookings, approved bookings, and rejected bookings can trigger email notifications.
- Email delivery failures do not block booking or approval flows.
- Key admin actions, such as deleting rooms, changing bookings, managing links, and updating email settings, are recorded for auditability.

## Domain Objects

| Object | Description |
| --- | --- |
| Room | A bookable space with location, capacity, equipment notes, opening hours, and booking rules |
| Door display device | A tablet or display device accessed by a device code and optionally bound to a default room |
| Booking | A room occupancy record with title, contact, email, time range, source, and status |
| Booking link | A public entry point generated by an admin, either global or limited to one room |
| Admin | A user account that can access the admin console, with enable, disable, and password reset support |
| Email settings | Notification toggle, email subject, and reply instructions |

## Typical Workflows

### Admin Setup

1. Deploy the system and apply database migrations.
2. Create the first admin account.
3. Sign in at `/admin/login`.
4. Create rooms and configure booking rules in Rooms.
5. Create door-display devices and bind default rooms in Devices.
6. Create booking links and QR codes in Links & QR.
7. If email notifications are needed, configure Email and send a test email.

### User Booking

1. Open the public booking page or scan a room-specific QR code.
2. Select a room, date, and time.
3. Review existing bookings and booking-rule hints.
4. Enter meeting title, contact name, and email.
5. Submit the booking.
6. Receive either a confirmed result or a pending approval result.

### Admin Operations

1. Check room status on the Dashboard.
2. View, filter, cancel, or delete bookings in Bookings.
3. Process pending approvals in Approvals.
4. If competing approvals create a conflict, the system blocks the approval and reports the conflict.

## Door Display Deployment

Door displays work best as fixed devices tied to fixed rooms, fixed power, and a fixed browser page.

### Tablet Setup

- Create one device per tablet in Devices, for example `boardroom-pad`.
- Bind the device to a default room.
- Open `/pad/<deviceCode>` in the tablet browser.
- Confirm that the page shows the room name, today's schedule, and a QR code.
- Mount the tablet outside the room and keep Wi-Fi stable.
- Use continuous power instead of relying on battery operation for a full day.

### iPad Always-On Tips

Menu names vary across iPadOS versions, but common settings include:

- Open Settings, go to Display & Brightness, and set Auto-Lock to Never.
- If the device is managed by company MDM, confirm that MDM does not enforce a short lock timeout.
- Open the door display in Safari and add it to the Home Screen to reduce browser chrome.
- Use Guided Access to limit users from leaving the display page. This is usually enabled in Accessibility and triggered by triple-clicking the side or home button.
- Lower brightness for long-running displays to reduce heat and screen aging.
- If lighting changes significantly near the room, disable auto brightness and choose a stable manual level.

### Android Tablet Always-On Tips

Settings differ by manufacturer, but common options include:

- In Display or Lock Screen settings, set Screen timeout or Sleep to Never, or to the longest available duration.
- If Never is unavailable, enable Stay awake while charging in Developer options.
- Open the page in Chrome and add it to the home screen, or use the device's kiosk or single-app mode.
- For managed devices, consider MDM, Android Enterprise, or the vendor's kiosk tools.
- When keeping the charger connected long term, use reliable power adapters and cables, and check periodically for heat, swelling, or loose cables.

### Browser And On-Site Checks

- The door display needs network access to the backend. Use stable Wi-Fi in meeting areas.
- If the page stops updating, check network, power, auto-lock settings, and whether the device is still enabled in Devices.
- The page syncs every 10 seconds. After creating or changing a booking, wait for the next refresh.
- The QR code points to the current room booking page. After changing the default room, refresh the tablet and verify the QR code.
- Door displays work best in full-screen mode with system notifications and update prompts hidden.
- Do a weekly check: screen on, correct time, scannable QR code, correct room binding, and no overheating.

## Booking Rules

When a booking is created, the system checks:

- The room exists and is enabled.
- End time is later than start time.
- Date and time are within the room's opening rules.
- The booking does not exceed the room's maximum advance booking window.
- Duration is not shorter than the minimum or longer than the maximum.
- Confirmed and pending bookings both occupy time slots.
- Room buffer time is included in conflict detection.
- Public bookings follow the room's approval rule; admin-created bookings are confirmed directly.
- Approval rechecks conflicts before confirming a pending booking.

Main status transitions:

```text
Pending approval -> Approved -> Confirmed
Pending approval -> Rejected -> Rejected
Confirmed / Pending approval -> Admin cancel -> Cancelled
```

The self-service cancellation entry point has been removed. Users who need to change or cancel bookings should contact an admin.

## Deployment And Operations

### Required Configuration

| Configuration | Description |
| --- | --- |
| D1 database | Stores rooms, devices, bookings, admins, booking links, and email settings |
| `JWT_SECRET` | Admin login token secret; use at least 32 random characters |
| `PUBLIC_BASE_URL` | Public application URL used to generate booking links and QR codes |

### Optional Configuration

| Configuration | Description |
| --- | --- |
| `RESEND_API_KEY` or `EMAIL_API_KEY` | Email service API key |
| `EMAIL_FROM` | Email sender address |

### Operations Tips

- Before enabling a room, verify open dates, opening hours, minimum and maximum duration, and buffer time.
- Enable approval rules for rooms that need manual review.
- Disable or delete booking links that are no longer used.
- After moving a door display to another room, update its default room and refresh the display.
- Disable admin accounts promptly after role changes or offboarding.
- If email notifications are enabled, send test emails periodically to confirm delivery.

<details>
<summary>Developer appendix: technical overview, commands, and API groups</summary>

## Technical Overview

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Hono, Cloudflare Pages Functions |
| Database | Cloudflare D1 |
| Authentication | JWT, bcryptjs |
| Validation | Zod, @hono/zod-validator |
| Email | Resend API |
| Tests | Vitest, Testing Library, jsdom |

## Common Commands

```bash
npm install
npm run dev
npm run build
npm run dev:worker
npm test
cp wrangler.example.toml wrangler.toml
npm run db:migrate:local
npm run db:migrate:remote
npm run deploy
```

## First Admin Account

The system does not provide an anonymous admin creation page. After the first deployment, create the first admin account manually.

Generate a password hash:

```bash
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.argv[1], 12));" "<temporary-admin-password>"
```

Insert the admin into D1:

```bash
npx wrangler d1 execute capymeet --remote --command "
INSERT INTO admins (id, email, name, password_hash, is_enabled, created_at, updated_at)
VALUES (
  'admin-1',
  'admin@your-domain.example',
  'Admin',
  '<paste-bcrypt-hash-here>',
  1,
  datetime('now'),
  datetime('now')
);
"
```

## Main Frontend Paths

| Path | Page |
| --- | --- |
| `/` | Public booking page |
| `/book/:token` | Booking link entry |
| `/pad/:deviceCode` | Door display |
| `/cancel` | Cancellation unavailable notice |
| `/admin/login` | Admin login |
| `/admin` | Admin dashboard |
| `/admin/rooms` | Room management |
| `/admin/devices` | Door display device management |
| `/admin/bookings` | Booking management |
| `/admin/approvals` | Approval management |
| `/admin/links` | Booking links and QR codes |
| `/admin/email-settings` | Email settings |
| `/admin/admins` | Admin accounts |

## Main API Groups

| Group | Purpose |
| --- | --- |
| `/api/public/*` | Public rooms, schedules, booking links, and public booking creation |
| `/api/tablet/*` | Door display device data and heartbeat |
| `/api/admin/*` | Authenticated admin APIs |

## Tests

```bash
npm test
```

Tests cover time utilities, booking rules, repositories, API routes, page components, and database migrations.

</details>

## Related Docs

- [Cloudflare deployment guide, Chinese](docs/cloudflare-deployment-zh.md)
- [User manual, Chinese](docs/user-manual-zh.md)

## Technical Support

For technical support, contact: frostrs@163.com

## License

Copyright 2026 CapyMeet Team.

This project is open source under the Apache License 2.0. See [LICENSE](LICENSE).
