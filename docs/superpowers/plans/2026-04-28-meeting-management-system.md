# Meeting Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent Cloudflare-hosted meeting room management system with tablet room displays, public booking/cancellation, admin management, conflict detection, optional email notifications, and D1 persistence.

**Architecture:** Use a Vite React TypeScript frontend deployed on Cloudflare Pages, with a Cloudflare Workers API built with Hono. Store relational data in Cloudflare D1. Keep booking validation and conflict detection in a shared server service used by public, tablet, and admin routes.

**Tech Stack:** TypeScript, React, Vite, Hono, Cloudflare Workers, Cloudflare D1, Wrangler, Vitest, React Testing Library, Zod, bcryptjs, jose, qrcode.

---

## Source Spec

Implement from `docs/superpowers/specs/2026-04-28-meeting-management-system-design.md`.

## File Structure

Create this structure:

- `package.json`: scripts and dependencies.
- `tsconfig.json`: TypeScript config for frontend, tests, and worker source.
- `vite.config.ts`: Vite React config and test environment.
- `wrangler.toml`: Cloudflare Pages/Workers and D1 binding config.
- `.gitignore`: excludes build output, dependencies, env files, and brainstorming artifacts.
- `migrations/0001_initial.sql`: D1 schema.
- `src/main.tsx`: React entry.
- `src/App.tsx`: route switch for public, tablet, and admin screens.
- `src/styles.css`: shared responsive styles.
- `src/shared/types.ts`: domain types shared by frontend and server.
- `src/shared/time.ts`: time parsing and overlap helpers.
- `src/shared/validation.ts`: Zod schemas for API payloads.
- `src/server/index.ts`: Hono app entry.
- `src/server/bindings.ts`: Cloudflare environment types.
- `src/server/db.ts`: D1 helpers.
- `src/server/repositories/*.ts`: D1 access by entity.
- `src/server/services/bookingService.ts`: booking creation, editing, cancellation, approval, and conflict detection.
- `src/server/services/emailService.ts`: optional email notification adapter.
- `src/server/services/authService.ts`: admin password/session helpers.
- `src/server/routes/public.ts`: public room, booking, link, and cancellation routes.
- `src/server/routes/tablet.ts`: tablet binding, heartbeat, and display routes.
- `src/server/routes/admin.ts`: admin auth, rooms, bookings, approvals, links, admins, logs.
- `src/client/api.ts`: frontend API client.
- `src/client/components/*.tsx`: shared UI components.
- `src/client/pages/*.tsx`: public, tablet, and admin pages.
- `src/**/*.test.ts` and `src/**/*.test.tsx`: unit and component tests.

Each task below should be completed and committed before moving to the next task.

---

### Task 1: Initialize Project Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `wrangler.toml`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Initialize git if the directory is not already a repository**

Run:

```bash
git rev-parse --is-inside-work-tree || git init
```

Expected: either `true` or a new repository initialized message.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "bookmetting",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:worker": "wrangler pages dev dist --d1 DB=bookmetting --compatibility-date=2026-04-28",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate:local": "wrangler d1 migrations apply bookmetting --local",
    "db:migrate:remote": "wrangler d1 migrations apply bookmetting --remote",
    "deploy": "npm run build && wrangler pages deploy dist"
  },
  "dependencies": {
    "@hono/zod-validator": "latest",
    "@vitejs/plugin-react": "latest",
    "bcryptjs": "latest",
    "hono": "latest",
    "jose": "latest",
    "qrcode": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/node": "latest",
    "@types/qrcode": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "wrangler": "latest"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 4: Create TypeScript and Vite config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["@cloudflare/workers-types", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "wrangler.toml"]
}
```

`vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
  },
});
```

- [ ] **Step 5: Create test setup**

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create Cloudflare and ignore config**

`wrangler.toml`:

```toml
name = "bookmetting"
compatibility_date = "2026-04-28"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "bookmetting"
database_id = "00000000-0000-0000-0000-000000000000"
```

`.gitignore`:

```gitignore
node_modules/
dist/
.wrangler/
.dev.vars
.env
.env.*
.superpowers/
```

- [ ] **Step 7: Create a minimal React app shell**

`src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>Meeting Room Manager</h1>
      <p>Cloudflare meeting room booking system.</p>
    </main>
  );
}
```

`src/styles.css`:

```css
:root {
  color: #172033;
  background: #f6f8fb;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  margin: 0 auto;
  max-width: 1120px;
  padding: 32px;
}
```

- [ ] **Step 8: Verify build**

Run:

```bash
npm run build
```

Expected: TypeScript succeeds and Vite creates `dist`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts wrangler.toml .gitignore src/main.tsx src/App.tsx src/styles.css src/test/setup.ts
git commit -m "chore: initialize Cloudflare React project"
```

---

### Task 2: Add D1 Schema and Shared Domain Types

**Files:**
- Create: `migrations/0001_initial.sql`
- Create: `src/shared/types.ts`
- Create: `src/shared/time.ts`
- Create: `src/shared/time.test.ts`

- [ ] **Step 1: Write failing time helper tests**

`src/shared/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { overlaps, toIsoMinute } from "./time";

describe("overlaps", () => {
  it("detects overlapping ranges", () => {
    expect(
      overlaps(
        "2026-04-28T10:00:00.000Z",
        "2026-04-28T11:00:00.000Z",
        "2026-04-28T10:30:00.000Z",
        "2026-04-28T11:30:00.000Z",
      ),
    ).toBe(true);
  });

  it("allows adjacent ranges", () => {
    expect(
      overlaps(
        "2026-04-28T10:00:00.000Z",
        "2026-04-28T11:00:00.000Z",
        "2026-04-28T11:00:00.000Z",
        "2026-04-28T12:00:00.000Z",
      ),
    ).toBe(false);
  });
});

describe("toIsoMinute", () => {
  it("normalizes an ISO timestamp to minute precision", () => {
    expect(toIsoMinute("2026-04-28T10:15:37.123Z")).toBe("2026-04-28T10:15:00.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/shared/time.test.ts
```

Expected: FAIL because `src/shared/time.ts` does not exist.

- [ ] **Step 3: Add shared types and time helpers**

`src/shared/types.ts`:

```ts
export type BookingStatus = "pending_approval" | "confirmed" | "cancelled" | "rejected" | "completed";
export type BookingSource = "public" | "tablet" | "admin";
export type BookingLinkType = "global" | "room_specific";

export interface Room {
  id: string;
  name: string;
  location: string;
  capacity: number | null;
  equipmentNotes: string | null;
  isEnabled: boolean;
  openingHours: string;
  slotMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  maxAdvanceDays: number;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  roomId: string;
  title: string;
  contactName: string;
  phone: string;
  email: string | null;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  source: BookingSource;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
}
```

`src/shared/time.ts`:

```ts
export function toIsoMinute(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  date.setUTCSeconds(0, 0);
  return date.toISOString();
}

export function overlaps(
  existingStart: string,
  existingEnd: string,
  requestedStart: string,
  requestedEnd: string,
): boolean {
  return new Date(existingStart).getTime() < new Date(requestedEnd).getTime()
    && new Date(existingEnd).getTime() > new Date(requestedStart).getTime();
}

export function minutesBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}
```

- [ ] **Step 4: Add D1 migration**

`migrations/0001_initial.sql`:

```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  capacity INTEGER,
  equipment_notes TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  opening_hours TEXT NOT NULL DEFAULT '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  min_duration_minutes INTEGER NOT NULL DEFAULT 30,
  max_duration_minutes INTEGER NOT NULL DEFAULT 240,
  max_advance_days INTEGER NOT NULL DEFAULT 30,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  device_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_room_id TEXT REFERENCES rooms(id),
  is_enabled INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  title TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'confirmed', 'cancelled', 'rejected', 'completed')),
  source TEXT NOT NULL CHECK (source IN ('public', 'tablet', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT,
  reviewed_by_admin_id TEXT,
  reviewed_at TEXT
);

CREATE INDEX idx_bookings_room_time ON bookings(room_id, start_time, end_time);
CREATE INDEX idx_bookings_phone_status ON bookings(phone, status, start_time);

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE booking_links (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('global', 'room_specific')),
  token TEXT NOT NULL UNIQUE,
  room_id TEXT REFERENCES rooms(id),
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_by_admin_id TEXT REFERENCES admins(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
```

- [ ] **Step 5: Verify tests pass**

Run:

```bash
npm test -- src/shared/time.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify local migration**

Run:

```bash
npm run db:migrate:local
```

Expected: migration applies to local D1.

- [ ] **Step 7: Commit**

```bash
git add migrations/0001_initial.sql src/shared/types.ts src/shared/time.ts src/shared/time.test.ts
git commit -m "feat: add D1 schema and shared domain types"
```

---

### Task 3: Implement Validation and Booking Service Core

**Files:**
- Create: `src/shared/validation.ts`
- Create: `src/server/services/bookingService.ts`
- Create: `src/server/services/bookingService.test.ts`

- [ ] **Step 1: Write failing booking service tests**

`src/server/services/bookingService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createBookingDecision } from "./bookingService";
import type { Booking, Room } from "../../shared/types";

const room: Room = {
  id: "room-1",
  name: "Board Room",
  location: "2F",
  capacity: 8,
  equipmentNotes: null,
  isEnabled: true,
  openingHours: '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
  slotMinutes: 30,
  minDurationMinutes: 30,
  maxDurationMinutes: 240,
  maxAdvanceDays: 30,
  requiresApproval: false,
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
};

const existing: Booking = {
  id: "booking-1",
  roomId: "room-1",
  title: "Existing",
  contactName: "Alice",
  phone: "13800000000",
  email: null,
  startTime: "2026-04-28T10:00:00.000Z",
  endTime: "2026-04-28T11:00:00.000Z",
  status: "confirmed",
  source: "public",
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
  cancelledAt: null,
  cancelledBy: null,
  reviewedByAdminId: null,
  reviewedAt: null,
};

describe("createBookingDecision", () => {
  it("rejects overlapping confirmed bookings", () => {
    const result = createBookingDecision({
      room,
      existingBookings: [existing],
      now: "2026-04-28T08:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        phone: "13900000000",
        email: null,
        startTime: "2026-04-28T10:30:00.000Z",
        endTime: "2026-04-28T11:30:00.000Z",
        source: "public",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("booking_conflict");
  });

  it("creates pending approval when the room requires approval", () => {
    const result = createBookingDecision({
      room: { ...room, requiresApproval: true },
      existingBookings: [],
      now: "2026-04-28T08:00:00.000Z",
      request: {
        title: "New",
        contactName: "Bob",
        phone: "13900000000",
        email: "bob@example.com",
        startTime: "2026-04-28T12:00:00.000Z",
        endTime: "2026-04-28T13:00:00.000Z",
        source: "public",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("pending_approval");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/server/services/bookingService.test.ts
```

Expected: FAIL because `bookingService.ts` does not exist.

- [ ] **Step 3: Add validation schemas**

`src/shared/validation.ts`:

```ts
import { z } from "zod";

export const createBookingSchema = z.object({
  roomId: z.string().min(1),
  title: z.string().min(1).max(120),
  contactName: z.string().min(1).max(80),
  phone: z.string().min(5).max(32),
  email: z.string().email().optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export const cancelSearchSchema = z.object({
  phone: z.string().min(5).max(32),
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  phone: z.string().min(5).max(32),
});
```

- [ ] **Step 4: Add booking service decision logic**

`src/server/services/bookingService.ts`:

```ts
import type { Booking, BookingSource, BookingStatus, Room } from "../../shared/types";
import { minutesBetween, overlaps } from "../../shared/time";

export interface CreateBookingRequest {
  title: string;
  contactName: string;
  phone: string;
  email: string | null;
  startTime: string;
  endTime: string;
  source: BookingSource;
}

export type BookingDecision =
  | { ok: true; status: Extract<BookingStatus, "confirmed" | "pending_approval"> }
  | { ok: false; error: "room_disabled" | "invalid_time_range" | "duration_too_short" | "duration_too_long" | "booking_conflict" };

export function createBookingDecision(input: {
  room: Room;
  existingBookings: Booking[];
  now: string;
  request: CreateBookingRequest;
}): BookingDecision {
  const { room, existingBookings, request } = input;

  if (!room.isEnabled) {
    return { ok: false, error: "room_disabled" };
  }

  const duration = minutesBetween(request.startTime, request.endTime);
  if (duration <= 0) {
    return { ok: false, error: "invalid_time_range" };
  }
  if (duration < room.minDurationMinutes) {
    return { ok: false, error: "duration_too_short" };
  }
  if (duration > room.maxDurationMinutes) {
    return { ok: false, error: "duration_too_long" };
  }

  const hasConflict = existingBookings
    .filter((booking) => booking.status === "confirmed" || booking.status === "pending_approval")
    .some((booking) => overlaps(booking.startTime, booking.endTime, request.startTime, request.endTime));

  if (hasConflict) {
    return { ok: false, error: "booking_conflict" };
  }

  return { ok: true, status: room.requiresApproval ? "pending_approval" : "confirmed" };
}
```

- [ ] **Step 5: Verify tests pass**

Run:

```bash
npm test -- src/server/services/bookingService.test.ts src/shared/time.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/validation.ts src/server/services/bookingService.ts src/server/services/bookingService.test.ts
git commit -m "feat: add booking validation service"
```

---

### Task 4: Add D1 Repositories

**Files:**
- Create: `src/server/bindings.ts`
- Create: `src/server/db.ts`
- Create: `src/server/repositories/roomsRepository.ts`
- Create: `src/server/repositories/bookingsRepository.ts`
- Create: `src/server/repositories/auditLogsRepository.ts`

- [ ] **Step 1: Create Cloudflare binding types**

`src/server/bindings.ts`:

```ts
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  PUBLIC_BASE_URL: string;
}
```

- [ ] **Step 2: Create D1 helper**

`src/server/db.ts`:

```ts
export function boolFromDb(value: number): boolean {
  return value === 1;
}

export function boolToDb(value: boolean): number {
  return value ? 1 : 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 3: Add rooms repository**

`src/server/repositories/roomsRepository.ts`:

```ts
import type { Room } from "../../shared/types";
import { boolFromDb, boolToDb, nowIso } from "../db";

interface RoomRow {
  id: string;
  name: string;
  location: string;
  capacity: number | null;
  equipment_notes: string | null;
  is_enabled: number;
  opening_hours: string;
  slot_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  max_advance_days: number;
  requires_approval: number;
  created_at: string;
  updated_at: string;
}

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    capacity: row.capacity,
    equipmentNotes: row.equipment_notes,
    isEnabled: boolFromDb(row.is_enabled),
    openingHours: row.opening_hours,
    slotMinutes: row.slot_minutes,
    minDurationMinutes: row.min_duration_minutes,
    maxDurationMinutes: row.max_duration_minutes,
    maxAdvanceDays: row.max_advance_days,
    requiresApproval: boolFromDb(row.requires_approval),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEnabledRooms(db: D1Database): Promise<Room[]> {
  const result = await db.prepare("SELECT * FROM rooms WHERE is_enabled = 1 ORDER BY name").all<RoomRow>();
  return result.results.map(mapRoom);
}

export async function getRoomById(db: D1Database, id: string): Promise<Room | null> {
  const row = await db.prepare("SELECT * FROM rooms WHERE id = ?").bind(id).first<RoomRow>();
  return row ? mapRoom(row) : null;
}

export async function createRoom(db: D1Database, room: Omit<Room, "createdAt" | "updatedAt">): Promise<Room> {
  const now = nowIso();
  await db.prepare(
    `INSERT INTO rooms (id, name, location, capacity, equipment_notes, is_enabled, opening_hours, slot_minutes, min_duration_minutes, max_duration_minutes, max_advance_days, requires_approval, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      room.id,
      room.name,
      room.location,
      room.capacity,
      room.equipmentNotes,
      boolToDb(room.isEnabled),
      room.openingHours,
      room.slotMinutes,
      room.minDurationMinutes,
      room.maxDurationMinutes,
      room.maxAdvanceDays,
      boolToDb(room.requiresApproval),
      now,
      now,
    )
    .run();

  return { ...room, createdAt: now, updatedAt: now };
}
```

- [ ] **Step 4: Add bookings repository**

`src/server/repositories/bookingsRepository.ts`:

```ts
import type { Booking, BookingStatus } from "../../shared/types";

interface BookingRow {
  id: string;
  room_id: string;
  title: string;
  contact_name: string;
  phone: string;
  email: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  source: "public" | "tablet" | "admin";
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  reviewed_by_admin_id: string | null;
  reviewed_at: string | null;
}

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    reviewedByAdminId: row.reviewed_by_admin_id,
    reviewedAt: row.reviewed_at,
  };
}

export async function listBlockingBookings(db: D1Database, roomId: string, startTime: string, endTime: string): Promise<Booking[]> {
  const result = await db.prepare(
    `SELECT * FROM bookings
     WHERE room_id = ?
       AND status IN ('confirmed', 'pending_approval')
       AND start_time < ?
       AND end_time > ?
     ORDER BY start_time`,
  )
    .bind(roomId, endTime, startTime)
    .all<BookingRow>();
  return result.results.map(mapBooking);
}

export async function listCancellableByPhone(db: D1Database, phone: string, now: string): Promise<Booking[]> {
  const result = await db.prepare(
    `SELECT * FROM bookings
     WHERE phone = ?
       AND status IN ('confirmed', 'pending_approval')
       AND start_time >= ?
     ORDER BY start_time`,
  )
    .bind(phone, now)
    .all<BookingRow>();
  return result.results.map(mapBooking);
}

export async function insertBooking(db: D1Database, booking: Booking): Promise<void> {
  await db.prepare(
    `INSERT INTO bookings (id, room_id, title, contact_name, phone, email, start_time, end_time, status, source, created_at, updated_at, cancelled_at, cancelled_by, reviewed_by_admin_id, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      booking.id,
      booking.roomId,
      booking.title,
      booking.contactName,
      booking.phone,
      booking.email,
      booking.startTime,
      booking.endTime,
      booking.status,
      booking.source,
      booking.createdAt,
      booking.updatedAt,
      booking.cancelledAt,
      booking.cancelledBy,
      booking.reviewedByAdminId,
      booking.reviewedAt,
    )
    .run();
}
```

- [ ] **Step 5: Add audit log repository**

`src/server/repositories/auditLogsRepository.ts`:

```ts
export async function writeAuditLog(
  db: D1Database,
  input: {
    id: string;
    actorType: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  },
): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id,
      input.actorType,
      input.actorId,
      input.action,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata),
      input.createdAt,
    )
    .run();
}
```

- [ ] **Step 6: Verify TypeScript**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/bindings.ts src/server/db.ts src/server/repositories
git commit -m "feat: add D1 repositories"
```

---

### Task 5: Implement Public Booking API

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/routes/public.ts`
- Modify: `src/server/services/bookingService.ts`
- Modify: `src/server/repositories/bookingsRepository.ts`

- [ ] **Step 1: Extend booking repository with cancellation helpers**

Append to `src/server/repositories/bookingsRepository.ts`:

```ts
export async function getBookingById(db: D1Database, id: string): Promise<Booking | null> {
  const row = await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first<BookingRow>();
  return row ? mapBooking(row) : null;
}

export async function cancelBookingById(db: D1Database, id: string, cancelledBy: string, now: string): Promise<void> {
  await db.prepare(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(now, cancelledBy, now, id)
    .run();
}
```

- [ ] **Step 2: Add API-level booking creation function**

Append to `src/server/services/bookingService.ts`:

```ts
import { nowIso } from "../db";
import { getRoomById } from "../repositories/roomsRepository";
import { insertBooking, listBlockingBookings } from "../repositories/bookingsRepository";

export async function createBooking(db: D1Database, input: CreateBookingRequest & { roomId: string }): Promise<BookingDecision & { bookingId?: string }> {
  const room = await getRoomById(db, input.roomId);
  if (!room) {
    return { ok: false, error: "room_disabled" };
  }

  const existingBookings = await listBlockingBookings(db, input.roomId, input.startTime, input.endTime);
  const decision = createBookingDecision({
    room,
    existingBookings,
    now: nowIso(),
    request: input,
  });

  if (!decision.ok) {
    return decision;
  }

  const now = nowIso();
  const bookingId = crypto.randomUUID();
  await insertBooking(db, {
    id: bookingId,
    roomId: input.roomId,
    title: input.title,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
    startTime: input.startTime,
    endTime: input.endTime,
    status: decision.status,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
    cancelledBy: null,
    reviewedByAdminId: null,
    reviewedAt: null,
  });

  return { ...decision, bookingId };
}
```

- [ ] **Step 3: Create public routes**

`src/server/routes/public.ts`:

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { cancelBookingSchema, cancelSearchSchema, createBookingSchema } from "../../shared/validation";
import type { Env } from "../bindings";
import { nowIso } from "../db";
import { listEnabledRooms } from "../repositories/roomsRepository";
import { cancelBookingById, getBookingById, listCancellableByPhone } from "../repositories/bookingsRepository";
import { createBooking } from "../services/bookingService";

export const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get("/rooms", async (c) => {
  return c.json({ rooms: await listEnabledRooms(c.env.DB) });
});

publicRoutes.post("/bookings", zValidator("json", createBookingSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await createBooking(c.env.DB, {
    ...body,
    email: body.email ?? null,
    source: "public",
  });

  if (!result.ok) {
    return c.json({ error: result.error }, 409);
  }

  return c.json({ bookingId: result.bookingId, status: result.status }, 201);
});

publicRoutes.post("/cancellations/search", zValidator("json", cancelSearchSchema), async (c) => {
  const { phone } = c.req.valid("json");
  const bookings = await listCancellableByPhone(c.env.DB, phone, nowIso());
  return c.json({ bookings });
});

publicRoutes.post("/cancellations", zValidator("json", cancelBookingSchema), async (c) => {
  const { bookingId, phone } = c.req.valid("json");
  const booking = await getBookingById(c.env.DB, bookingId);

  if (!booking || booking.phone !== phone || !["confirmed", "pending_approval"].includes(booking.status)) {
    return c.json({ error: "booking_not_cancellable" }, 404);
  }

  await cancelBookingById(c.env.DB, bookingId, "public_phone", nowIso());
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Create Worker entry**

`src/server/index.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./bindings";
import { publicRoutes } from "./routes/public";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/public", publicRoutes);

export default app;
```

- [ ] **Step 5: Verify TypeScript**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/index.ts src/server/routes/public.ts src/server/services/bookingService.ts src/server/repositories/bookingsRepository.ts
git commit -m "feat: add public booking API"
```

---

### Task 6: Implement Admin Authentication and Admin API Base

**Files:**
- Create: `src/server/services/authService.ts`
- Create: `src/server/routes/admin.ts`
- Modify: `src/server/index.ts`
- Modify: `src/server/repositories/roomsRepository.ts`

- [ ] **Step 1: Add admin auth service**

`src/server/services/authService.ts`:

```ts
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createAdminToken(adminId: string, secret: string): Promise<string> {
  return new SignJWT({ adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAdminToken(token: string, secret: string): Promise<string | null> {
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof result.payload.adminId === "string" ? result.payload.adminId : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add room listing for admins**

Append to `src/server/repositories/roomsRepository.ts`:

```ts
export async function listAllRooms(db: D1Database): Promise<Room[]> {
  const result = await db.prepare("SELECT * FROM rooms ORDER BY name").all<RoomRow>();
  return result.results.map(mapRoom);
}
```

- [ ] **Step 3: Add admin routes**

`src/server/routes/admin.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../bindings";
import { listAllRooms } from "../repositories/roomsRepository";
import { createAdminToken } from "../services/authService";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: { adminId: string } }>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

adminRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const admin = await c.env.DB
    .prepare("SELECT id, password_hash, is_enabled FROM admins WHERE email = ?")
    .bind(body.email)
    .first<{ id: string; password_hash: string; is_enabled: number }>();

  if (!admin || admin.is_enabled !== 1) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  const { verifyPassword } = await import("../services/authService");
  const valid = await verifyPassword(body.password, admin.password_hash);
  if (!valid) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  return c.json({ token: await createAdminToken(admin.id, c.env.JWT_SECRET) });
});

adminRoutes.use("*", async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { verifyAdminToken } = await import("../services/authService");
  const adminId = await verifyAdminToken(token, c.env.JWT_SECRET);
  if (!adminId) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("adminId", adminId);
  await next();
});

adminRoutes.get("/rooms", async (c) => {
  return c.json({ rooms: await listAllRooms(c.env.DB) });
});
```

- [ ] **Step 4: Mount admin routes**

Modify `src/server/index.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./bindings";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/public", publicRoutes);
app.route("/api/admin", adminRoutes);

export default app;
```

- [ ] **Step 5: Verify TypeScript**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/authService.ts src/server/routes/admin.ts src/server/index.ts src/server/repositories/roomsRepository.ts
git commit -m "feat: add admin authentication base"
```

---

### Task 7: Implement Tablet API

**Files:**
- Create: `src/server/routes/tablet.ts`
- Create: `src/server/repositories/devicesRepository.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 1: Add devices repository**

`src/server/repositories/devicesRepository.ts`:

```ts
import { boolFromDb, nowIso } from "../db";

export interface Device {
  id: string;
  deviceCode: string;
  name: string;
  defaultRoomId: string | null;
  isEnabled: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeviceRow {
  id: string;
  device_code: string;
  name: string;
  default_room_id: string | null;
  is_enabled: number;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    deviceCode: row.device_code,
    name: row.name,
    defaultRoomId: row.default_room_id,
    isEnabled: boolFromDb(row.is_enabled),
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getDeviceByCode(db: D1Database, deviceCode: string): Promise<Device | null> {
  const row = await db.prepare("SELECT * FROM devices WHERE device_code = ?").bind(deviceCode).first<DeviceRow>();
  return row ? mapDevice(row) : null;
}

export async function updateDeviceHeartbeat(db: D1Database, deviceCode: string): Promise<void> {
  const now = nowIso();
  await db.prepare("UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE device_code = ?")
    .bind(now, now, deviceCode)
    .run();
}
```

- [ ] **Step 2: Add tablet routes**

`src/server/routes/tablet.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "../bindings";
import { getDeviceByCode, updateDeviceHeartbeat } from "../repositories/devicesRepository";
import { getRoomById, listEnabledRooms } from "../repositories/roomsRepository";

export const tabletRoutes = new Hono<{ Bindings: Env }>();

tabletRoutes.get("/:deviceCode", async (c) => {
  const device = await getDeviceByCode(c.env.DB, c.req.param("deviceCode"));
  if (!device || !device.isEnabled) {
    return c.json({ error: "device_not_found" }, 404);
  }

  const defaultRoom = device.defaultRoomId ? await getRoomById(c.env.DB, device.defaultRoomId) : null;
  const rooms = await listEnabledRooms(c.env.DB);
  return c.json({ device, defaultRoom, rooms });
});

tabletRoutes.post("/:deviceCode/heartbeat", async (c) => {
  await updateDeviceHeartbeat(c.env.DB, c.req.param("deviceCode"));
  return c.json({ ok: true });
});
```

- [ ] **Step 3: Mount tablet routes**

Modify `src/server/index.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./bindings";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";
import { tabletRoutes } from "./routes/tablet";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/public", publicRoutes);
app.route("/api/tablet", tabletRoutes);
app.route("/api/admin", adminRoutes);

export default app;
```

- [ ] **Step 4: Verify TypeScript**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/tablet.ts src/server/repositories/devicesRepository.ts src/server/index.ts
git commit -m "feat: add tablet device API"
```

---

### Task 8: Add Optional Email Service

**Files:**
- Create: `src/server/services/emailService.ts`
- Modify: `src/server/routes/public.ts`

- [ ] **Step 1: Add email service with no-send behavior when email is absent**

`src/server/services/emailService.ts`:

```ts
export type EmailEvent = "booking_confirmed" | "booking_pending" | "booking_cancelled" | "booking_approved" | "booking_rejected";

export interface EmailInput {
  event: EmailEvent;
  to: string | null;
  subject: string;
  text: string;
}

export async function sendOptionalEmail(input: EmailInput, env: { EMAIL_API_KEY?: string; EMAIL_FROM?: string }): Promise<{ sent: boolean; reason?: string }> {
  if (!input.to) {
    return { sent: false, reason: "missing_recipient" };
  }
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    return { sent: false, reason: "email_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  return response.ok ? { sent: true } : { sent: false, reason: `provider_${response.status}` };
}
```

- [ ] **Step 2: Call email service after public booking and cancellation**

In `src/server/routes/public.ts`, import:

```ts
import { sendOptionalEmail } from "../services/emailService";
```

After successful booking creation, before returning:

```ts
await sendOptionalEmail(
  {
    event: result.status === "confirmed" ? "booking_confirmed" : "booking_pending",
    to: body.email ?? null,
    subject: result.status === "confirmed" ? "Meeting booking confirmed" : "Meeting booking submitted for approval",
    text: `Your meeting "${body.title}" is ${result.status}.`,
  },
  c.env,
);
```

After successful cancellation:

```ts
await sendOptionalEmail(
  {
    event: "booking_cancelled",
    to: booking.email,
    subject: "Meeting booking cancelled",
    text: `Your meeting "${booking.title}" has been cancelled.`,
  },
  c.env,
);
```

- [ ] **Step 3: Verify TypeScript**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/emailService.ts src/server/routes/public.ts
git commit -m "feat: add optional email notifications"
```

---

### Task 9: Build Frontend API Client and Public Pages

**Files:**
- Create: `src/client/api.ts`
- Create: `src/client/pages/PublicBookingPage.tsx`
- Create: `src/client/pages/CancellationPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add API client**

`src/client/api.ts`:

```ts
import type { Booking, Room } from "../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listRooms: () => request<{ rooms: Room[] }>("/api/public/rooms"),
  createBooking: (body: {
    roomId: string;
    title: string;
    contactName: string;
    phone: string;
    email: string | null;
    startTime: string;
    endTime: string;
  }) => request<{ bookingId: string; status: string }>("/api/public/bookings", { method: "POST", body: JSON.stringify(body) }),
  searchCancellations: (phone: string) => request<{ bookings: Booking[] }>("/api/public/cancellations/search", { method: "POST", body: JSON.stringify({ phone }) }),
  cancelBooking: (bookingId: string, phone: string) => request<{ ok: true }>("/api/public/cancellations", { method: "POST", body: JSON.stringify({ bookingId, phone }) }),
};
```

- [ ] **Step 2: Add public booking page**

`src/client/pages/PublicBookingPage.tsx`:

```tsx
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import type { Room } from "../../shared/types";

export function PublicBookingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.listRooms().then((data) => setRooms(data.rooms)).catch(() => setMessage("Unable to load rooms."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await api.createBooking({
      roomId: String(form.get("roomId")),
      title: String(form.get("title")),
      contactName: String(form.get("contactName")),
      phone: String(form.get("phone")),
      email: String(form.get("email") || "") || null,
      startTime: new Date(String(form.get("startTime"))).toISOString(),
      endTime: new Date(String(form.get("endTime"))).toISOString(),
    });
    setMessage(result.status === "confirmed" ? "Booking confirmed." : "Booking submitted for approval.");
  }

  return (
    <section className="card">
      <h1>Book a Meeting Room</h1>
      <form className="form" onSubmit={submit}>
        <select name="roomId" required>
          <option value="">Select room</option>
          {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
        </select>
        <input name="title" required aria-label="Meeting title" />
        <input name="contactName" required aria-label="Contact name" />
        <input name="phone" required aria-label="Phone number" />
        <input name="email" type="email" aria-label="Email optional" />
        <input name="startTime" type="datetime-local" required />
        <input name="endTime" type="datetime-local" required />
        <button type="submit">Submit booking</button>
      </form>
      {message && <p>{message}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Add cancellation page**

`src/client/pages/CancellationPage.tsx`:

```tsx
import { FormEvent, useState } from "react";
import { api } from "../api";
import type { Booking } from "../../shared/types";

export function CancellationPage() {
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault();
    const result = await api.searchCancellations(phone);
    setBookings(result.bookings);
    setMessage(result.bookings.length === 0 ? "No future cancellable bookings found." : "");
  }

  async function cancel(bookingId: string) {
    await api.cancelBooking(bookingId, phone);
    setBookings((items) => items.filter((item) => item.id !== bookingId));
    setMessage("Booking cancelled.");
  }

  return (
    <section className="card">
      <h1>Cancel Booking</h1>
      <form className="form" onSubmit={search}>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} required aria-label="Phone number" />
        <button type="submit">Find bookings</button>
      </form>
      {bookings.map((booking) => (
        <article className="list-row" key={booking.id}>
          <span>{booking.title} · {new Date(booking.startTime).toLocaleString()}</span>
          <button onClick={() => cancel(booking.id)}>Cancel</button>
        </article>
      ))}
      {message && <p>{message}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Route pages by path**

`src/App.tsx`:

```tsx
import { CancellationPage } from "./client/pages/CancellationPage";
import { PublicBookingPage } from "./client/pages/PublicBookingPage";

export function App() {
  const path = window.location.pathname;

  if (path.startsWith("/cancel")) {
    return <CancellationPage />;
  }

  return <PublicBookingPage />;
}
```

- [ ] **Step 5: Add form styles**

Append to `src/styles.css`:

```css
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  box-shadow: 0 12px 40px rgb(15 23 42 / 8%);
  margin: 32px auto;
  max-width: 720px;
  padding: 32px;
}

.form {
  display: grid;
  gap: 14px;
}

.form input,
.form select {
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 12px 14px;
}

.form button,
.list-row button {
  background: #2563eb;
  border: 0;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  padding: 12px 14px;
}

.list-row {
  align-items: center;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  padding: 14px 0;
}
```

- [ ] **Step 6: Verify build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/client src/App.tsx src/styles.css
git commit -m "feat: add public booking and cancellation pages"
```

---

### Task 10: Build Tablet Display Page

**Files:**
- Create: `src/client/pages/TabletPage.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Extend API client for tablet**

Append to `src/client/api.ts` inside the `api` object:

```ts
getTablet: (deviceCode: string) => request<{ device: { deviceCode: string; defaultRoomId: string | null }; defaultRoom: Room | null; rooms: Room[] }>(`/api/tablet/${deviceCode}`),
sendHeartbeat: (deviceCode: string) => request<{ ok: true }>(`/api/tablet/${deviceCode}/heartbeat`, { method: "POST" }),
```

- [ ] **Step 2: Add tablet page**

`src/client/pages/TabletPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Room } from "../../shared/types";

export function TabletPage({ deviceCode }: { deviceCode: string }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const selectedRoom = useMemo(() => rooms.find((room) => room.id === selectedRoomId) ?? null, [rooms, selectedRoomId]);

  useEffect(() => {
    api.getTablet(deviceCode).then((data) => {
      setRooms(data.rooms);
      setSelectedRoomId(data.defaultRoom?.id ?? data.rooms[0]?.id ?? "");
    });
    const timer = window.setInterval(() => api.sendHeartbeat(deviceCode).catch(() => undefined), 60000);
    return () => window.clearInterval(timer);
  }, [deviceCode]);

  return (
    <section className="tablet">
      <header className="tablet-header">
        <div>
          <p>Meeting Room</p>
          <h1>{selectedRoom?.name ?? "No room selected"}</h1>
        </div>
        <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
          {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
        </select>
      </header>
      <div className="status-panel available">Available</div>
      <div className="tablet-actions">
        <a href="/book/global">Book this room</a>
        <a href="/cancel">Cancel by phone</a>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Route tablet page**

Modify `src/App.tsx`:

```tsx
import { CancellationPage } from "./client/pages/CancellationPage";
import { PublicBookingPage } from "./client/pages/PublicBookingPage";
import { TabletPage } from "./client/pages/TabletPage";

export function App() {
  const path = window.location.pathname;

  if (path.startsWith("/pad/")) {
    return <TabletPage deviceCode={path.split("/")[2]} />;
  }
  if (path.startsWith("/cancel")) {
    return <CancellationPage />;
  }

  return <PublicBookingPage />;
}
```

- [ ] **Step 4: Add tablet styles**

Append to `src/styles.css`:

```css
.tablet {
  min-height: 100vh;
  padding: 32px;
}

.tablet-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.tablet-header h1 {
  font-size: clamp(42px, 8vw, 88px);
  margin: 0;
}

.status-panel {
  border-radius: 32px;
  color: white;
  font-size: clamp(48px, 10vw, 120px);
  font-weight: 800;
  margin: 40px 0;
  padding: 80px 32px;
  text-align: center;
}

.status-panel.available {
  background: #16a34a;
}

.tablet-actions {
  display: flex;
  gap: 16px;
}

.tablet-actions a {
  background: #172033;
  border-radius: 18px;
  color: white;
  padding: 18px 24px;
  text-decoration: none;
}
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/client/pages/TabletPage.tsx src/client/api.ts src/App.tsx src/styles.css
git commit -m "feat: add tablet room display"
```

---

### Task 11: Build Admin Frontend Skeleton

**Files:**
- Create: `src/client/pages/AdminLoginPage.tsx`
- Create: `src/client/pages/AdminDashboardPage.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Extend API client for admin login and rooms**

Append to `src/client/api.ts`:

```ts
export function getAdminToken(): string | null {
  return window.localStorage.getItem("adminToken");
}

export function setAdminToken(token: string): void {
  window.localStorage.setItem("adminToken", token);
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  return request<T>(path, {
    ...init,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      ...init?.headers,
    },
  });
}
```

- [ ] **Step 2: Add admin login page**

`src/client/pages/AdminLoginPage.tsx`:

```tsx
import { FormEvent, useState } from "react";
import { setAdminToken } from "../api";

export function AdminLoginPage() {
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email")),
        password: String(form.get("password")),
      }),
    });

    if (!response.ok) {
      setError("Invalid credentials.");
      return;
    }

    const data = await response.json() as { token: string };
    setAdminToken(data.token);
    window.location.href = "/admin";
  }

  return (
    <section className="card">
      <h1>Admin Login</h1>
      <form className="form" onSubmit={submit}>
        <input name="email" type="email" required aria-label="Admin email" />
        <input name="password" type="password" required aria-label="Password" />
        <button type="submit">Login</button>
      </form>
      {error && <p>{error}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Add admin dashboard skeleton**

`src/client/pages/AdminDashboardPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { adminRequest } from "../api";
import type { Room } from "../../shared/types";

export function AdminDashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    adminRequest<{ rooms: Room[] }>("/api/admin/rooms").then((data) => setRooms(data.rooms));
  }, []);

  return (
    <section className="admin-layout">
      <aside className="admin-nav">
        <strong>Admin</strong>
        <a href="/admin">Dashboard</a>
        <a href="/admin/rooms">Rooms</a>
        <a href="/admin/bookings">Bookings</a>
        <a href="/admin/approvals">Approvals</a>
        <a href="/admin/links">Links & QR</a>
        <a href="/admin/admins">Admins</a>
      </aside>
      <main className="admin-main">
        <h1>Room Status</h1>
        {rooms.map((room) => (
          <article className="list-row" key={room.id}>
            <span>{room.name}</span>
            <span>{room.requiresApproval ? "Requires approval" : "Auto confirm"}</span>
          </article>
        ))}
      </main>
    </section>
  );
}
```

- [ ] **Step 4: Route admin pages**

Modify `src/App.tsx`:

```tsx
import { AdminDashboardPage } from "./client/pages/AdminDashboardPage";
import { AdminLoginPage } from "./client/pages/AdminLoginPage";
import { CancellationPage } from "./client/pages/CancellationPage";
import { PublicBookingPage } from "./client/pages/PublicBookingPage";
import { TabletPage } from "./client/pages/TabletPage";

export function App() {
  const path = window.location.pathname;

  if (path.startsWith("/admin/login")) {
    return <AdminLoginPage />;
  }
  if (path.startsWith("/admin")) {
    return <AdminDashboardPage />;
  }
  if (path.startsWith("/pad/")) {
    return <TabletPage deviceCode={path.split("/")[2]} />;
  }
  if (path.startsWith("/cancel")) {
    return <CancellationPage />;
  }

  return <PublicBookingPage />;
}
```

- [ ] **Step 5: Add admin layout styles**

Append to `src/styles.css`:

```css
.admin-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.admin-nav {
  background: #0f172a;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

.admin-nav a {
  color: #dbeafe;
  text-decoration: none;
}

.admin-main {
  padding: 32px;
}
```

- [ ] **Step 6: Verify build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/client/pages/AdminLoginPage.tsx src/client/pages/AdminDashboardPage.tsx src/client/api.ts src/App.tsx src/styles.css
git commit -m "feat: add admin frontend skeleton"
```

---

### Task 12: Complete Admin Operations and QR Links

**Files:**
- Modify: `src/server/routes/admin.ts`
- Create: `src/server/repositories/bookingLinksRepository.ts`
- Create: `src/client/pages/AdminLinksPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add booking links repository**

`src/server/repositories/bookingLinksRepository.ts`:

```ts
import type { BookingLinkType } from "../../shared/types";
import { nowIso } from "../db";

export async function createBookingLink(db: D1Database, input: { type: BookingLinkType; roomId: string | null; adminId: string }): Promise<{ id: string; token: string }> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replaceAll("-", "");
  const now = nowIso();
  await db.prepare(
    `INSERT INTO booking_links (id, type, token, room_id, is_enabled, created_by_admin_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
  )
    .bind(id, input.type, token, input.roomId, input.adminId, now, now)
    .run();
  return { id, token };
}

export async function listBookingLinks(db: D1Database): Promise<Array<{ id: string; type: BookingLinkType; token: string; roomId: string | null; isEnabled: boolean }>> {
  const result = await db.prepare("SELECT id, type, token, room_id, is_enabled FROM booking_links ORDER BY created_at DESC")
    .all<{ id: string; type: BookingLinkType; token: string; room_id: string | null; is_enabled: number }>();

  return result.results.map((row) => ({
    id: row.id,
    type: row.type,
    token: row.token,
    roomId: row.room_id,
    isEnabled: row.is_enabled === 1,
  }));
}
```

- [ ] **Step 2: Add admin link routes**

Append to `src/server/routes/admin.ts` after authenticated middleware:

```ts
import QRCode from "qrcode";
import { createBookingLink, listBookingLinks } from "../repositories/bookingLinksRepository";
```

Add routes:

```ts
adminRoutes.get("/links", async (c) => {
  return c.json({ links: await listBookingLinks(c.env.DB) });
});

adminRoutes.post("/links", async (c) => {
  const body = await c.req.json<{ type: "global" | "room_specific"; roomId?: string }>();
  const link = await createBookingLink(c.env.DB, {
    type: body.type,
    roomId: body.type === "room_specific" ? body.roomId ?? null : null,
    adminId: c.get("adminId"),
  });
  const url = `${c.env.PUBLIC_BASE_URL}/book/${link.token}`;
  return c.json({ ...link, url, qrCodeDataUrl: await QRCode.toDataURL(url) }, 201);
});
```

- [ ] **Step 3: Add admin links page**

`src/client/pages/AdminLinksPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { adminRequest } from "../api";

interface LinkRow {
  id: string;
  type: "global" | "room_specific";
  token: string;
  roomId: string | null;
  isEnabled: boolean;
}

export function AdminLinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);

  async function load() {
    const data = await adminRequest<{ links: LinkRow[] }>("/api/admin/links");
    setLinks(data.links);
  }

  async function createGlobal() {
    await adminRequest("/api/admin/links", { method: "POST", body: JSON.stringify({ type: "global" }) });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="card">
      <h1>Booking Links</h1>
      <button onClick={createGlobal}>Create global link</button>
      {links.map((link) => (
        <article className="list-row" key={link.id}>
          <span>{link.type}</span>
          <code>/book/{link.token}</code>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Route admin links page**

In `src/App.tsx`, add before the generic `/admin` route:

```tsx
if (path.startsWith("/admin/links")) {
  return <AdminLinksPage />;
}
```

Also import:

```tsx
import { AdminLinksPage } from "./client/pages/AdminLinksPage";
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/repositories/bookingLinksRepository.ts src/server/routes/admin.ts src/client/pages/AdminLinksPage.tsx src/App.tsx
git commit -m "feat: add booking link and QR management"
```

---

### Task 13: Final Verification and Deployment Notes

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/plans/2026-04-28-meeting-management-system.md` only to check off completed boxes during execution.

- [ ] **Step 1: Create README**

`README.md`:

```md
# Bookmetting

Cloudflare-hosted meeting room management system with tablet room displays, public booking, phone-number cancellation, admin management, D1 storage, and optional email notifications.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

Apply local D1 migrations:

```bash
npm run db:migrate:local
```

## Configuration

Required production values:

- `DB`: Cloudflare D1 binding.
- `JWT_SECRET`: secret for admin tokens.
- `PUBLIC_BASE_URL`: deployed application URL.

Optional email values:

- `EMAIL_API_KEY`
- `EMAIL_FROM`

Email is sent only when a booking includes an email address and the email provider is configured.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test && npm run build
```

Expected: all tests pass and Vite build succeeds.

- [ ] **Step 3: Confirm D1 migration command works locally**

Run:

```bash
npm run db:migrate:local
```

Expected: local D1 migrations apply without SQL errors.

- [ ] **Step 4: Commit final docs**

```bash
git add README.md docs/superpowers/plans/2026-04-28-meeting-management-system.md
git commit -m "docs: add deployment and implementation notes"
```

---

## Self-Review

Spec coverage:

- Tablet room display is covered by Tasks 7 and 10.
- Public booking and phone-number cancellation are covered by Tasks 3, 5, and 9.
- Conflict detection and pending approval blocking are covered by Tasks 2 and 3.
- D1 persistence is covered by Tasks 2 and 4.
- Admin backend, multiple administrators, room visibility, and QR links are covered by Tasks 6, 11, and 12.
- Optional email behavior is covered by Task 8.
- Cloudflare deployment configuration is covered by Tasks 1, 2, and 13.

Known follow-up scope after this plan:

- Add richer calendar views and room rule editing forms after the skeleton admin flows are working.
- Add a seed script for first admin and demo rooms once the database layer is stable.
- Add integration tests against a local D1 database after the API route surface is complete.
