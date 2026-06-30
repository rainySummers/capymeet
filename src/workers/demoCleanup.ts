import { cleanupDemoDatabase } from "../server/demoCleanup";

interface CleanupEnv {
  DB: D1Database;
}

export default {
  async scheduled(_controller, env) {
    await cleanupDemoDatabase(env.DB);
  },

  fetch() {
    return Response.json({ ok: true, service: "capymeet-demo-cleanup" });
  },
} satisfies ExportedHandler<CleanupEnv>;
