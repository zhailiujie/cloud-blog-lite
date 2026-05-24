import { Hono } from 'hono'
import type { Env } from '../../env'
import { hashPassword } from '../../utils/crypto'
import { createId, nowIso } from '../../utils/id'
import { fail, ok } from '../../utils/response'

interface SetupAdminRequest {
  username?: string
  password?: string
  nickname?: string
}

export const setupRoutes = new Hono<{ Bindings: Env }>()

setupRoutes.get('/status', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(1) AS total FROM users').first<{ total: number }>()
  const initialized = Number(row?.total || 0) > 0

  return c.json(
    ok({
      initialized,
    }),
  )
})

setupRoutes.post('/admin', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(1) AS total FROM users').first<{ total: number }>()
  const userCount = Number(row?.total || 0)

  if (userCount > 0) {
    return c.json(fail('System has already been initialized', 403), 403)
  }

  const body = await c.req.json<SetupAdminRequest>().catch(() => null)
  const username = body?.username?.trim()
  const password = body?.password || ''
  const nickname = body?.nickname?.trim() || '超级管理员'

  if (!username || username.length < 3 || username.length > 32) {
    return c.json(fail('Username length must be between 3 and 32 characters', 400), 400)
  }

  if (password.length < 8 || password.length > 72) {
    return c.json(fail('Password length must be between 8 and 72 characters', 400), 400)
  }

  const id = createId()
  const time = nowIso()
  const passwordHash = await hashPassword(password)

  await c.env.DB.prepare(
    `INSERT INTO users (
      id,
      username,
      password_hash,
      nickname,
      role,
      status,
      login_error_count,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, username, passwordHash, nickname, 'admin', 1, 0, time, time)
    .run()

  return c.json(
    ok({
      id,
      username,
      nickname,
      role: 'admin',
      status: 1,
      createdAt: time,
    }),
  )
})
