import { Hono } from "hono";
import type { Env } from "../../env";
import { hashPassword } from "../../utils/crypto";
import { createId, nowIso } from "../../utils/id";
import { fail, ok } from "../../utils/response";

interface SetupAdminRequest {
  username?: string;
  password?: string;
  nickname?: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]+$/;

export const setupRoutes = new Hono<{ Bindings: Env }>();

setupRoutes.get("/status", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT COUNT(1) AS total FROM users",
  ).first<{ total: number }>();
  const initialized = Number(row?.total || 0) > 0;
  return c.json(ok({ initialized }));
});

setupRoutes.post("/admin", async (c) => {
  const body = await c.req.json<SetupAdminRequest>().catch(() => null);
  const username = body?.username?.trim();
  const password = body?.password || "";
  const nickname = body?.nickname?.trim() || "超级管理员";

  if (!username || username.length < 3 || username.length > 32) {
    return c.json(
      fail("Username length must be between 3 and 32 characters", 400),
      400,
    );
  }
  if (!USERNAME_REGEX.test(username)) {
    return c.json(
      fail(
        "Username can only contain letters, numbers, underscores, hyphens and dots",
        400,
      ),
      400,
    );
  }
  if (password.length < 8 || password.length > 72) {
    return c.json(
      fail("Password length must be between 8 and 72 characters", 400),
      400,
    );
  }

  const id = createId();
  const time = nowIso();
  const passwordHash = await hashPassword(password);

  // 用 WHERE NOT EXISTS 将「检查用户数为 0」与「插入」合并为原子操作，消除 TOCTOU 竞态
  const result = await c.env.DB.prepare(
    `INSERT INTO users (id, username, password_hash, nickname, role, status, login_error_count, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1)`,
  )
    .bind(id, username, passwordHash, nickname, "admin", 1, 0, time, time)
    .run();

  // changes = 0 表示 WHERE NOT EXISTS 未通过，系统已初始化
  if (!result.meta.changes) {
    return c.json(fail("System has already been initialized", 403), 403);
  }

  return c.json(
    ok({ id, username, nickname, role: "admin", status: 1, createdAt: time }),
  );
});
