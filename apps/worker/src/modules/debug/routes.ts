import { Hono } from 'hono'
import type { Env } from '../../env'
import { ok } from '../../utils/response'

export const debugRoutes = new Hono<{ Bindings: Env }>()

debugRoutes.get('/bindings', async (c) => {
  const dbCheck = c.env.DB
    ? await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
    : null

  return c.json(
    ok({
      appName: c.env.APP_NAME || 'cloud-blog-lite-worker',
      d1: {
        bound: Boolean(c.env.DB),
        check: dbCheck?.ok === 1,
      },
      r2: {
        bound: Boolean(c.env.R2),
      },
    }),
  )
})
