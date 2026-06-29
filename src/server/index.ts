import { Hono } from "hono";

import type { Env } from "./bindings";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";
import { tabletRoutes } from "./routes/tablet";

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/public", publicRoutes);
app.route("/api/tablet", tabletRoutes);
app.route("/api/admin", adminRoutes);

export default app;
