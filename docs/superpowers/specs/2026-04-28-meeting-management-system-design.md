# Meeting Management System Design

## Overview

This system manages meeting room availability, reservations, cancellations, approvals, and room-door tablet displays. It is an independent scheduling system and does not integrate with Google Calendar, Outlook, or other external calendars in the first version.

The target deployment platform is Cloudflare. The recommended architecture is Cloudflare Pages for the web frontend, Cloudflare Workers for the API, and Cloudflare D1 for relational storage.

## Goals

- Use existing tablets as room-door displays for meeting room status.
- Show the current and upcoming meetings for each room.
- Allow users to reserve or cancel meetings from tablets and online booking links.
- Prevent reservations when a room already has a confirmed or pending approval meeting in the selected time range.
- Provide an admin backend for all room schedules, booking edits, approvals, room settings, links, QR codes, and administrator accounts.
- Support global booking links and room-specific booking links.
- Send email notifications only when the user provides an email address.
- Deploy cleanly on Cloudflare.

## Non-Goals

- No external calendar integration in the first version.
- No SMS verification or SMS notification.
- No mandatory email address for booking.
- No complex role-based permissions in the first version.
- No Durable Objects in the first version, although the booking service should be isolated enough to migrate later if concurrency pressure requires it.

## Architecture

The application has three user-facing entry points:

- Tablet display for room-door usage.
- Public online booking page.
- Admin backend.

All entry points call the same Workers API. The API owns authentication, room rules, conflict detection, reservation lifecycle transitions, cancellation, approvals, link resolution, and optional email notification. Cloudflare D1 stores rooms, devices, bookings, administrators, booking links, and audit logs.

The booking and conflict detection logic must live in a shared service layer used by public, tablet, and admin APIs. The frontend should not make final availability decisions by itself.

## Product Modules

### Room Management

Admins can create and maintain meeting rooms with:

- Name.
- Location.
- Capacity.
- Equipment notes.
- Enabled or disabled status.
- Per-room booking rules.

Each room can configure:

- Opening hours.
- Time slot granularity.
- Minimum and maximum booking duration.
- Maximum advance booking window.
- Whether bookings require admin approval.

For this design, pending approval bookings always occupy their time slot.

### Tablet Door Display

Each tablet has a default bound room. The tablet display shows:

- Current room status.
- Current meeting, if any.
- Upcoming meetings.
- Quick booking for the default room.
- Cancellation by phone number.
- A room switcher for viewing other rooms.

The tablet should be optimized for long-running display on a room door. It should work in both tablet landscape and portrait layouts.

Status values shown to users:

- Available.
- In use.
- Starting soon.
- Pending approval occupied.

### Public Booking Page

The public booking page supports two link types:

- Global booking link: user selects a room before booking.
- Room-specific booking link: room is preselected and locked to the link target.

Booking form fields:

- Meeting title.
- Contact name.
- Phone number, required.
- Email address, optional.
- Start time.
- End time.

Phone number is required because it is used for cancellation. Email is optional. If the user provides an email address, the system sends reservation, cancellation, and approval result notifications. If no email is provided, the page result is the only confirmation.

### Cancellation

Users cancel without logging in. They enter the phone number used during booking. The system lists that phone number's future `confirmed` and `pending_approval` bookings. If there are multiple bookings, the user selects which one to cancel.

This is intentionally a low-friction, low-security cancellation model. Anyone who knows the phone number could attempt cancellation. The UI should avoid exposing unnecessary sensitive information in the cancellation list.

### Admin Backend

Admins log into a dedicated backend. The backend supports multiple administrator accounts. Admins can:

- View all room schedules in calendar and list views.
- Filter by room, date, and booking status.
- Create, edit, cancel, and approve bookings.
- Configure rooms and room-specific booking rules.
- Generate global and room-specific booking links and QR codes.
- Create, disable, and reset administrator accounts.
- View audit logs for key operations.

Admin edits to booking time or room must reuse the same validation and conflict detection logic as public booking.

### Notifications

Notifications are optional. The system sends email only when a booking has an email address. Phone numbers are not used for SMS.

Email events:

- Booking confirmed.
- Booking submitted for approval.
- Booking cancelled.
- Booking approved.
- Booking rejected.

Email delivery failures should not block booking creation, cancellation, or approval. Failures should be logged for admin visibility or later troubleshooting.

## Booking Lifecycle

Booking statuses:

- `pending_approval`: booking requires admin approval and occupies the time slot.
- `confirmed`: booking is confirmed and occupies the time slot.
- `cancelled`: booking was cancelled and does not occupy the time slot.
- `rejected`: booking was rejected and does not occupy the time slot.
- `completed`: booking ended and is retained for history or reporting.

Creation flow:

1. User selects room and time.
2. User enters meeting title, contact name, required phone number, and optional email.
3. API loads the room and rules.
4. API validates enabled status, opening hours, slot granularity, duration limits, and advance booking window.
5. API queries D1 for overlapping `confirmed` or `pending_approval` bookings in the same room.
6. If any overlap exists, API returns a conflict error and does not create the booking.
7. If the room requires approval, API creates `pending_approval`.
8. Otherwise, API creates `confirmed`.
9. API sends email only if an email address exists.

Time overlap rule:

A booking conflicts when it has the same room and:

`existing.start_time < requested.end_time AND existing.end_time > requested.start_time`

Only `confirmed` and `pending_approval` bookings block new bookings.

Cancellation flow:

1. User enters phone number.
2. API returns future `confirmed` and `pending_approval` bookings for that phone number.
3. User selects a booking.
4. API marks it as `cancelled`.
5. API sends cancellation email only if the booking has an email address.

Approval flow:

1. Admin views pending approvals.
2. Admin approves or rejects a booking.
3. Approving moves it to `confirmed`.
4. Rejecting moves it to `rejected` and releases the time slot.
5. API sends result email only if the booking has an email address.

## Data Model

### `rooms`

Stores meeting room information and rule configuration.

Important fields:

- `id`
- `name`
- `location`
- `capacity`
- `equipment_notes`
- `is_enabled`
- `opening_hours`
- `slot_minutes`
- `min_duration_minutes`
- `max_duration_minutes`
- `max_advance_days`
- `requires_approval`
- `created_at`
- `updated_at`

### `devices`

Stores tablet devices and their default room binding.

Important fields:

- `id`
- `device_code`
- `name`
- `default_room_id`
- `is_enabled`
- `last_seen_at`
- `created_at`
- `updated_at`

### `bookings`

Stores reservations.

Important fields:

- `id`
- `room_id`
- `title`
- `contact_name`
- `phone`
- `email`
- `start_time`
- `end_time`
- `status`
- `source`
- `created_at`
- `updated_at`
- `cancelled_at`
- `cancelled_by`
- `reviewed_by_admin_id`
- `reviewed_at`

### `admins`

Stores backend administrator accounts.

Important fields:

- `id`
- `email`
- `name`
- `password_hash`
- `is_enabled`
- `last_login_at`
- `created_at`
- `updated_at`

### `booking_links`

Stores public booking links and QR code targets.

Important fields:

- `id`
- `type`
- `token`
- `room_id`
- `is_enabled`
- `created_by_admin_id`
- `created_at`
- `updated_at`

`type` is either `global` or `room_specific`. `room_id` is set only for room-specific links.

### `audit_logs`

Stores important admin and system events.

Important fields:

- `id`
- `actor_type`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

## API Boundaries

### Public API

Used by tablets and public booking pages for non-admin actions:

- List enabled rooms.
- Get room schedule.
- Resolve booking link token.
- Create booking.
- Search cancellable bookings by phone number.
- Cancel selected booking.

### Tablet API

Used by tablet devices:

- Register or bind device by device code.
- Get default room.
- Update default room binding when allowed by admin flow.
- Send heartbeat.
- Fetch display data for a room.

### Admin API

Used by the admin backend:

- Login and logout.
- Manage rooms.
- Query all bookings.
- Create, edit, cancel, approve, and reject bookings.
- Manage booking links and QR codes.
- Manage administrators.
- Query audit logs.

## Frontend Structure

Recommended routes:

- `/pad/:deviceCode` for tablet display.
- `/book/:token` for global or room-specific public booking.
- `/cancel` for phone-number-based cancellation.
- `/admin/login` for admin login.
- `/admin` for dashboard.
- `/admin/rooms` for room management.
- `/admin/bookings` for booking management.
- `/admin/approvals` for pending approvals.
- `/admin/links` for booking links and QR codes.
- `/admin/admins` for administrator accounts.
- `/admin/audit-logs` for audit logs.

The tablet UI should prioritize a large status display and a short list of upcoming meetings. The admin UI should prioritize calendar and list views for fast schedule inspection.

## Deployment

Cloudflare services:

- Cloudflare Pages for frontend hosting.
- Cloudflare Workers for API.
- Cloudflare D1 for relational data.
- External email provider for optional email notifications.

Production configuration:

- D1 binding.
- Session or JWT secret.
- Initial administrator creation path or seed script.
- Email provider API key and sender address.
- Public base URL for generated links and QR codes.

## Testing Strategy

Priority tests:

- Conflict detection for overlapping and adjacent bookings.
- Per-room time rules.
- Pending approval bookings blocking time slots.
- Phone-number cancellation with single and multiple future bookings.
- Admin edit revalidation and conflict detection.
- Optional email behavior when email is present or absent.
- Booking link resolution for global and room-specific links.

Important edge cases:

- Booking exactly ending when another starts should be allowed.
- Booking exactly starting when another ends should be allowed.
- Disabled rooms cannot be booked.
- Cancelled and rejected bookings do not block time slots.
- Admin edits cannot create hidden conflicts.

## Risks and Mitigations

### Low-security cancellation

Phone-number-only cancellation is easy to use but not strong authentication. The UI should show limited booking details and the admin audit log should retain cancellation events.

### D1 concurrency

D1 is suitable for the first version, but concurrent booking attempts for the same room and time need careful handling. The booking service should be isolated so it can later move to Durable Objects if real usage shows conflict races.

### Email reliability

Email delivery should not be treated as part of the booking transaction. The system should log delivery failures and keep booking state authoritative in D1.

### Tablet reliability

Room-door tablets may run for long periods. The tablet UI should refresh display data periodically, show stale-data state if API calls fail, and avoid requiring frequent manual reloads.
