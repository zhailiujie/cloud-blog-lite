import { Hono } from "hono";
import type { Env } from "../../env";
import type { AuthVariables } from "../../middleware/auth";
import { createId, nowIso } from "../../utils/id";
import { hashPassword } from "../../utils/crypto";
import { fail, ok } from "../../utils/response";
import { writeOperationLog } from "../../utils/log";
import { parsePagination } from "../../utils/pagination";

type UserRole = "admin" | "editor" | "viewer";

interface UserRow {
  id: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  role: UserRole;
  status: number;
  remark: string | null;
  login_error_count: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateUserRequest {
  username?: string;
  password?: string;
  nickname?: string;
  avatar?: string;
  role?: UserRole;
  status?: number;
  remark?: string;
}

interface UpdateUserRequest {
  nickname?: string;
  avatar?: string;
  role?: UserRole;
  status?: number;
  remark?: string;
}

interface ResetPasswordRequest {
  password?: string;
}

function toUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    role: row.role,
    status: row.status,
    remark: row.remark,
    loginErrorCount: row.login_error_count,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]+$/;

function normalizeRole(role?: string): UserRole {
  return role === "admin" || role === "editor" || role === "viewer"
    ? role
    : "viewer";
}



export const userRoutes = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

userRoutes.get("/", async (c) => {
  const pagination = parsePagination((name) => c.req.query(name));
  const [rows, totalResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, username, nickname, avatar, role, status, remark, login_error_count, last_login_at, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(pagination.pageSize, pagination.offset),
    c.env.DB.prepare("SELECT COUNT(1) AS total FROM users"),
  ]) as [D1Result<UserRow>, D1Result<{ total: number }>];

  return c.json(ok({
    items: (rows.results || []).map(toUser),
    total: Number(totalResult.results?.[0]?.total || 0),
    page: pagination.page,
    pageSize: pagination.pageSize,
  }));
});

userRoutes.post("/", async (c) => {
  const body = await c.req.json<CreateUserRequest>().catch(() => null);
  const username = body?.username?.trim();
  const password = body?.password || "";

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

  const exists = await c.env.DB.prepare(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
  )
    .bind(username)
    .first<{ id: string }>();
  if (exists) {
    return c.json(fail("Username already exists", 400), 400);
  }

  const id = createId();
  const time = nowIso();
  const role = normalizeRole(body?.role);
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    `INSERT INTO users (id, username, password_hash, nickname, avatar, role, status, remark, login_error_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(
      id,
      username,
      passwordHash,
      body?.nickname?.trim() || "",
      body?.avatar?.trim() || "",
      role,
      body?.status === 0 ? 0 : 1,
      body?.remark?.trim() || "",
      time,
      time,
    )
    .run();

  const currentUser = c.get("user");
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: "create_user",
    module: "user",
    description: "新增用户",
    detail: { id, username, role },
    ip: c.req.header("CF-Connecting-IP"),
    userAgent: c.req.header("User-Agent"),
  });

  return c.json(
    ok({
      id,
      username,
      role,
      status: body?.status === 0 ? 0 : 1,
      createdAt: time,
      updatedAt: time,
    }),
  );
});

userRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const oldUser = await c.env.DB.prepare(
    "SELECT id, role, status FROM users WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first<{ id: string; role: UserRole; status: number }>();
  if (!oldUser) return c.json(fail("User not found", 404), 404);

  const body = await c.req
    .json<UpdateUserRequest>()
    .catch(() => ({}) as UpdateUserRequest);
  const nextRole = normalizeRole(body.role || oldUser.role);
  // 仅在明确传入 status 时才更新，防止省略字段时静默重新启用被禁用账号
  const nextStatus =
    body.status === 0 ? 0 : body.status === 1 ? 1 : oldUser.status;

  if (id === currentUser.sub && nextStatus === 0) {
    return c.json(fail("Cannot disable yourself", 400), 400);
  }

  if (
    oldUser.role === "admin" &&
    oldUser.status === 1 &&
    (nextRole !== "admin" || nextStatus === 0)
  ) {
    const time = nowIso();
    const result = await c.env.DB.prepare(
      `UPDATE users
       SET nickname = ?, avatar = ?, role = ?, status = ?, remark = ?, updated_at = ?
       WHERE id = ?
         AND (SELECT COUNT(1) FROM users WHERE role = 'admin' AND status = 1) > 1`,
    )
      .bind(
        body.nickname?.trim() || "",
        body.avatar?.trim() || "",
        nextRole,
        nextStatus,
        body.remark?.trim() || "",
        time,
        id,
      )
      .run();

    if (!result.meta.changes) {
      return c.json(
        fail("Cannot disable or demote the last active admin", 400),
        400,
      );
    }

    await writeOperationLog(c.env, {
      userId: currentUser.sub,
      username: currentUser.username,
      action: "update_user",
      module: "user",
      description: "更新用户",
      detail: { id, role: nextRole, status: nextStatus },
      ip: c.req.header("CF-Connecting-IP"),
      userAgent: c.req.header("User-Agent"),
    });

    return c.json(ok({ id, updatedAt: time }));
  }

  const time = nowIso();
  await c.env.DB.prepare(
    `UPDATE users SET nickname = ?, avatar = ?, role = ?, status = ?, remark = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      body.nickname?.trim() || "",
      body.avatar?.trim() || "",
      nextRole,
      nextStatus,
      body.remark?.trim() || "",
      time,
      id,
    )
    .run();

  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: "update_user",
    module: "user",
    description: "更新用户",
    detail: { id, role: nextRole, status: nextStatus },
    ip: c.req.header("CF-Connecting-IP"),
    userAgent: c.req.header("User-Agent"),
  });

  return c.json(ok({ id, updatedAt: time }));
});

userRoutes.post("/:id/reset-password", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<ResetPasswordRequest>().catch(() => null);
  const password = body?.password || "";
  if (password.length < 8 || password.length > 72) {
    return c.json(
      fail("Password length must be between 8 and 72 characters", 400),
      400,
    );
  }

  const exists = await c.env.DB.prepare(
    "SELECT id FROM users WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first<{ id: string }>();
  if (!exists) return c.json(fail("User not found", 404), 404);

  const time = nowIso();
  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, login_error_count = 0, updated_at = ? WHERE id = ?",
  )
    .bind(await hashPassword(password), time, id)
    .run();

  const currentUser = c.get("user");
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: "reset_password",
    module: "user",
    description: "重置用户密码",
    detail: { id },
    ip: c.req.header("CF-Connecting-IP"),
    userAgent: c.req.header("User-Agent"),
  });

  return c.json(ok(true));
});

userRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  if (id === currentUser.sub) {
    return c.json(fail("Cannot delete yourself", 400), 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, role, status FROM users WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first<{ id: string; role: UserRole; status: number }>();
  if (!user) return c.json(fail("User not found", 404), 404);

  if (user.role === "admin" && user.status === 1) {
    const result = await c.env.DB.prepare(
      `DELETE FROM users
       WHERE id = ?
         AND (SELECT COUNT(1) FROM users WHERE role = 'admin' AND status = 1) > 1`,
    )
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return c.json(fail("Cannot delete the last active admin", 400), 400);
    }
  } else {
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  }

  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: "delete_user",
    module: "user",
    description: "删除用户",
    detail: { id },
    ip: c.req.header("CF-Connecting-IP"),
    userAgent: c.req.header("User-Agent"),
  });

  return c.json(ok(true));
});
