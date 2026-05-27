import { Hono } from "hono";
import type { Env } from "../../env";
import { clearCookie, createCookie, getCookie, getCookieName } from "../../utils/cookie";
import { fail, ok } from "../../utils/response";
import { signJwt, verifyJwt } from "../../utils/jwt";
import { verifyPassword } from "../../utils/crypto";
import { nowIso } from "../../utils/id";

const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MAX_LOGIN_ERRORS = 10;
const DUMMY_PASSWORD_HASH =
  "pbkdf2$100000$AQEBAQEBAQEBAQEBAQEBAQ==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

interface LoginRequest {
  username?: string;
  password?: string;
  turnstileToken?: string;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  nickname: string | null;
  avatar: string | null;
  role: "admin" | "editor" | "viewer";
  status: number;
  login_error_count: number;
}

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}



function toCurrentUser(user: Omit<UserRow, "password_hash">) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
  };
}

async function verifyTurnstile(
  env: Env,
  token: string,
  ip?: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured");
  }

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
    },
  );

  if (!response.ok) return false;
  const result = await response
    .json<TurnstileVerifyResponse>()
    .catch(() => null);
  return Boolean(result?.success);
}

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<LoginRequest>().catch(() => null);
  const username = body?.username?.trim();
  const password = body?.password || "";
  const turnstileToken = body?.turnstileToken || "";

  if (!username || !password) {
    return c.json(fail("Username and password are required", 400), 400);
  }

  if (!turnstileToken) {
    return c.json(fail("Turnstile token is required", 400), 400);
  }

  const turnstileValid = await verifyTurnstile(
    c.env,
    turnstileToken,
    c.req.header("CF-Connecting-IP"),
  );
  if (!turnstileValid) {
    return c.json(fail("Turnstile verification failed", 403), 403);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, username, password_hash, nickname, avatar, role, status, login_error_count
     FROM users
     WHERE username = ?
     LIMIT 1`,
  )
    .bind(username)
    .first<UserRow>();

  if (!user) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return c.json(fail("Invalid username or password", 401), 401);
  }

  if (user.status !== 1) {
    return c.json(fail("User is disabled", 403), 403);
  }

  // 连续错误次数过多则锁定账号
  if (user.login_error_count >= MAX_LOGIN_ERRORS) {
    return c.json(
      fail("登录失败次数过多，账号已锁定，请联系管理员重置", 429),
      429,
    );
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    await c.env.DB.prepare(
      "UPDATE users SET login_error_count = login_error_count + 1, updated_at = ? WHERE id = ?",
    )
      .bind(nowIso(), user.id)
      .run();
    return c.json(fail("Invalid username or password", 401), 401);
  }

  const time = nowIso();
  await c.env.DB.prepare(
    "UPDATE users SET login_error_count = 0, last_login_at = ?, updated_at = ? WHERE id = ?",
  )
    .bind(time, time, user.id)
    .run();

  const token = await signJwt(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      nickname: user.nickname || undefined,
    },
    c.env,
    TOKEN_MAX_AGE_SECONDS,
  );

  c.header(
    "Set-Cookie",
    createCookie(getCookieName(c.env), token, TOKEN_MAX_AGE_SECONDS),
  );

  return c.json(ok(toCurrentUser(user)));
});

authRoutes.post("/logout", (c) => {
  c.header("Set-Cookie", clearCookie(getCookieName(c.env)));
  return c.json(ok(true));
});

authRoutes.get("/me", async (c) => {
  const token = getCookie(c.req.header("Cookie"), getCookieName(c.env));
  if (!token) {
    return c.json(fail("Unauthorized", 401), 401);
  }

  const payload = await verifyJwt(token, c.env);
  if (!payload) {
    return c.json(fail("Unauthorized", 401), 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, username, nickname, avatar, role, status
     FROM users
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(payload.sub)
    .first<Omit<UserRow, "password_hash">>();

  if (!user || user.status !== 1) {
    return c.json(fail("Unauthorized", 401), 401);
  }

  return c.json(ok(toCurrentUser(user)));
});
