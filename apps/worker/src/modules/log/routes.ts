import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { fail, ok } from '../../utils/response'
import { parsePagination } from '../../utils/pagination'

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
  const pagination = parsePagination((name) => c.req.query(name))
  const [rows, totalResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, user_id, username, action, module, description, detail, ip, user_agent, created_at
       FROM operation_logs
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(pagination.pageSize, pagination.offset),
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM operation_logs'),
  ]) as [D1Result<LogRow>, D1Result<{ total: number }>]

  return c.json(ok({
    items: (rows.results || []).map(toLog),
    total: Number(totalResult.results?.[0]?.total || 0),
    page: pagination.page,
    pageSize: pagination.pageSize,
  }))
})

logRoutes.delete('/cleanup', async (c) => {
  const beforeDays = Number(c.req.query('beforeDays') || 90)
  if (!Number.isFinite(beforeDays) || beforeDays < 1 || beforeDays > 3650) {
    return c.json(fail('Invalid beforeDays', 400), 400)
  }

  const before = new Date(Date.now() - beforeDays * 24 * 60 * 60 * 1000).toISOString()
  const result = await c.env.DB.prepare('DELETE FROM operation_logs WHERE created_at < ?').bind(before).run()
  return c.json(ok({ deleted: result.meta.changes || 0, before }))
})
