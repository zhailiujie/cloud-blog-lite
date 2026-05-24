import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { fail, ok } from '../../utils/response'

interface LogRow {
  id: string
  user_id: string | null
  username: string | null
  action: string
  module: string | null
  description: string | null
  detail: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

function toLog(row: LogRow) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    action: row.action,
    module: row.module,
    description: row.description,
    detail: row.detail,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }
}

export const logRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

logRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, user_id, username, action, module, description, detail, ip, user_agent, created_at
     FROM operation_logs
     ORDER BY created_at DESC
     LIMIT 100`,
  ).all<LogRow>()

  return c.json(ok((rows.results || []).map(toLog)))
})

logRoutes.delete('/cleanup', async (c) => {
  const beforeDays = Number(c.req.query('beforeDays') || 90)
  if (!Number.isFinite(beforeDays) || beforeDays < 1) {
    return c.json(fail('Invalid beforeDays', 400), 400)
  }

  const before = new Date(Date.now() - beforeDays * 24 * 60 * 60 * 1000).toISOString()
  const result = await c.env.DB.prepare('DELETE FROM operation_logs WHERE created_at < ?').bind(before).run()
  return c.json(ok({ deleted: result.meta.changes || 0, before }))
})
