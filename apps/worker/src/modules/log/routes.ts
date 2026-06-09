import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { fail, ok } from '../../utils/response'
import { parsePagination } from '../../utils/pagination'
import { writeOperationLog } from '../../utils/log'

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
  const conditions: string[] = []
  const params: Array<string | number> = []
  const module = c.req.query('module')?.trim()
  const action = c.req.query('action')?.trim()
  const username = c.req.query('username')?.trim()
  const startAt = c.req.query('startAt')?.trim()
  const endAt = c.req.query('endAt')?.trim()

  if (module) {
    conditions.push('module = ?')
    params.push(module)
  }
  if (action) {
    conditions.push('action = ?')
    params.push(action)
  }
  if (username) {
    conditions.push('username LIKE ?')
    params.push(`%${username}%`)
  }
  if (startAt) {
    conditions.push('created_at >= ?')
    params.push(startAt)
  }
  if (endAt) {
    conditions.push('created_at <= ?')
    params.push(endAt)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows, totalResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, user_id, username, action, module, description, detail, ip, user_agent, created_at
       FROM operation_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(...params, pagination.pageSize, pagination.offset),
    c.env.DB.prepare(`SELECT COUNT(1) AS total FROM operation_logs ${where}`).bind(...params),
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
  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'cleanup',
    module: 'operation-log',
    description: `清理 ${beforeDays} 天前操作日志`,
    detail: { deleted: result.meta.changes || 0, before },
  })

  return c.json(ok({ deleted: result.meta.changes || 0, before }))
})
