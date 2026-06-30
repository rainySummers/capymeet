# CapyMeet Demo Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real weekly demo database cleanup Worker, show an admin login demo warning, and deploy the app to a new `capymeet-demo` Cloudflare Pages project.

**Architecture:** The React admin login page owns the user-facing warning through existing admin i18n. A small server helper owns the cleanup table order and can be tested without Cloudflare. A dedicated Cloudflare Worker imports that helper and runs it from `scheduled()`.

**Tech Stack:** React, Vitest, Vite, Cloudflare Pages Functions, Cloudflare Workers Cron Triggers, Cloudflare D1, Wrangler.

---

## File Structure

- Modify `src/client/i18n/adminI18n.tsx` to add English and Chinese warning copy.
- Modify `src/client/pages/AdminLoginPage.tsx` to render a dismissible modal dialog on page load.
- Modify `src/client/pages/AdminLoginPage.test.tsx` to verify the warning appears and can be dismissed.
- Create `src/server/demoCleanup.ts` to expose the cleanup table list and cleanup function.
- Create `src/server/demoCleanup.test.ts` to verify the cleanup order and admin preservation.
- Create `src/workers/demoCleanup.ts` to expose the Cloudflare Worker `scheduled()` handler.
- Create `wrangler.demo-cleanup.example.toml` as a non-secret template for the cleanup Worker.
- Modify `package.json` scripts for targeted demo cleanup deployment.

## Task 1: Login Demo Warning

**Files:**
- Modify: `src/client/i18n/adminI18n.tsx`
- Modify: `src/client/pages/AdminLoginPage.tsx`
- Modify: `src/client/pages/AdminLoginPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

Add a test that renders `AdminLoginPage`, expects a dialog named `Demo environment`, checks the weekly cleanup warning text, clicks `I understand`, and expects the dialog to disappear.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/client/pages/AdminLoginPage.test.tsx`

Expected: failure because no demo warning dialog exists yet.

- [ ] **Step 3: Add i18n keys**

Add keys:

```ts
"login.demoWarningTitle": "Demo environment",
"login.demoWarningBody": "This site is for demo use only. Do not use it as a production environment. The demo database is cleared automatically once per week.",
"login.demoWarningDismiss": "I understand",
```

Chinese:

```ts
"login.demoWarningTitle": "演示环境",
"login.demoWarningBody": "此站点仅用于演示，请不要作为生产环境使用。演示数据库每周会自动清理一次。",
"login.demoWarningDismiss": "我知道了",
```

- [ ] **Step 4: Render the modal**

Add local state in `AdminLoginPage`:

```ts
const [showDemoWarning, setShowDemoWarning] = useState(true);
```

Render an accessible dialog before the login card when `showDemoWarning` is true.

- [ ] **Step 5: Add scoped styles**

Add `.demo-warning-backdrop`, `.demo-warning-dialog`, `.demo-warning-body`, and `.demo-warning-actions` to `src/styles.css`.

- [ ] **Step 6: Run the focused test**

Run: `npx vitest run src/client/pages/AdminLoginPage.test.tsx`

Expected: all tests in the file pass.

## Task 2: Cleanup Helper And Worker

**Files:**
- Create: `src/server/demoCleanup.ts`
- Create: `src/server/demoCleanup.test.ts`
- Create: `src/workers/demoCleanup.ts`
- Create: `wrangler.demo-cleanup.example.toml`
- Modify: `package.json`

- [ ] **Step 1: Write the failing cleanup test**

Create a fake D1 database whose `prepare(sql).run()` records SQL strings. Test that `cleanupDemoDatabase(db)` issues `DELETE FROM` statements for demo tables and never deletes from `admins`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/demoCleanup.test.ts`

Expected: failure because `src/server/demoCleanup.ts` does not exist yet.

- [ ] **Step 3: Implement cleanup helper**

Create `src/server/demoCleanup.ts` with:

```ts
export const demoCleanupTables = [
  "audit_logs",
  "booking_links",
  "bookings",
  "devices",
  "rooms",
  "email_settings",
  "business_settings",
] as const;

export async function cleanupDemoDatabase(db: D1Database): Promise<void> {
  for (const table of demoCleanupTables) {
    await db.prepare(`DELETE FROM ${table}`).run();
  }
}
```

- [ ] **Step 4: Implement Worker entrypoint**

Create `src/workers/demoCleanup.ts` with a `scheduled()` handler that calls `cleanupDemoDatabase(env.DB)` and a minimal `fetch()` health response.

- [ ] **Step 5: Add Wrangler template and package scripts**

Add `wrangler.demo-cleanup.example.toml` with weekly cron syntax and placeholder D1 ID. Add a package script for deploying the Worker with a local copied config.

- [ ] **Step 6: Run the focused cleanup test**

Run: `npx vitest run src/server/demoCleanup.test.ts`

Expected: all tests in the file pass.

## Task 3: Full Verification

**Files:**
- All files changed above.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run src/client/pages/AdminLoginPage.test.tsx src/server/demoCleanup.test.ts
```

Expected: both test files pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build succeed.

## Task 4: New Cloudflare Demo Deployment

**Files:**
- Local ignored deployment config: `wrangler.toml`
- Local ignored deployment config copied from `wrangler.demo-cleanup.example.toml`

- [ ] **Step 1: Confirm Cloudflare login**

Run:

```bash
npx wrangler whoami
```

Expected: authenticated Cloudflare account details.

- [ ] **Step 2: Create new D1 database**

Run:

```bash
npx wrangler d1 create capymeet-demo
```

Expected: Cloudflare returns a D1 `database_id`.

- [ ] **Step 3: Create local Pages Wrangler config**

Create ignored `wrangler.toml` with `name = "capymeet-demo"`, `pages_build_output_dir = "dist"`, and the returned D1 `database_id`.

- [ ] **Step 4: Apply remote migrations**

Run:

```bash
npx wrangler d1 migrations apply capymeet-demo --remote
```

Expected: all migrations apply to the new D1 database.

- [ ] **Step 5: Create Pages project**

Run:

```bash
npx wrangler pages project create capymeet-demo --production-branch=main
```

Expected: Pages project is created, or Wrangler reports it already exists.

- [ ] **Step 6: Configure secrets and variables**

Set `JWT_SECRET` as a Pages secret and `PUBLIC_BASE_URL=https://capymeet-demo.pages.dev` as a Pages environment variable.

- [ ] **Step 7: Deploy Pages**

Run:

```bash
npm run build
npx wrangler pages deploy dist --project-name capymeet-demo
```

Expected: Cloudflare returns a new `capymeet-demo.pages.dev` deployment URL.

- [ ] **Step 8: Deploy cleanup Worker**

Create ignored Worker Wrangler config using the D1 `database_id`, then run:

```bash
npx wrangler deploy --config wrangler.demo-cleanup.toml
```

Expected: Worker `capymeet-demo-cleanup` deploys with a weekly cron trigger.

- [ ] **Step 9: Seed demo admin**

Insert a demo admin into `capymeet-demo` with a temporary password hash, preserving that account across weekly cleanup.

- [ ] **Step 10: Smoke check**

Open or request `https://capymeet-demo.pages.dev/api/health`.

Expected: JSON response `{ "ok": true }`.

## Self-Review

- Spec coverage: login warning, new Pages/D1, weekly cleanup Worker, admin preservation, tests, and deployment are covered.
- Placeholder scan: no placeholders remain in implementation behavior; only Cloudflare IDs are intentionally local deployment values.
- Type consistency: cleanup helper accepts `D1Database`, matching Cloudflare bindings used by Pages Functions and Workers.
