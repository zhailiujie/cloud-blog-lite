import { Hono } from "hono";
import type { Env } from "./env";
import { errorMiddleware } from "./middleware/error";
import { authRoutes } from "./modules/auth/routes";
import { backupRoutes } from "./modules/backup/routes";
import { categoryRoutes } from "./modules/category/routes";
import { dashboardRoutes } from "./modules/dashboard/routes";
import { debugRoutes } from "./modules/debug/routes";
import { logRoutes } from "./modules/log/routes";
import { publicRoutes } from "./modules/public/routes";
import { settingRoutes } from "./modules/setting/routes";
import { setupRoutes } from "./modules/setup/routes";
import { siteRoutes } from "./modules/site/routes";
import { fileRoutes, uploadRoutes } from "./modules/upload/routes";
import { userRoutes } from "./modules/user/routes";
import { authMiddleware } from "./middleware/auth";
import { requireRole } from "./middleware/role";
import { ok } from "./utils/response";
import { runD1Backup } from "./modules/backup/service";

type Bindings = Env;

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

app.use("*", errorMiddleware);

app.route("/public", publicRoutes);
app.route("/files", fileRoutes);
app.route("/auth", authRoutes);
app.use("/admin/*", authMiddleware);
app.route("/admin/dashboard", dashboardRoutes);
app.route("/admin/categories", categoryRoutes);
app.use("/admin/users/*", requireRole(["admin"]));
app.route("/admin/users", userRoutes);
app.route("/admin/sites", siteRoutes);
app.route("/admin/upload", uploadRoutes);
app.route("/admin/settings", settingRoutes);
app.route("/admin/operation-logs", logRoutes);
app.use("/admin/backups/*", requireRole(["admin"]));
app.route("/admin/backups", backupRoutes);
app.route("/debug", debugRoutes);
app.route("/setup", setupRoutes);

app.get("/health", (c) => {
  return c.json(
    ok({
      service: c.env.APP_NAME || "cloud-blog-lite-worker",
      status: "UP",
      time: new Date().toISOString(),
    }),
  );
});

app.notFound((c) =>
  c.json({ code: 404, message: "Not Found", data: null }, 404),
);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runD1Backup(env));
  },
};
