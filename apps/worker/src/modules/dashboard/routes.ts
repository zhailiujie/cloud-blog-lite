import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { ok } from '../../utils/response'

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

async function count(db: D1Database, sql: string) {
  const row = await db.prepare(sql).first<{ total: number }>()
  return Number(row?.total || 0)
}

dashboardRoutes.get('/stats', async (c) => {
  const [categoryCount, siteCount, visibleSiteCount, userCount, logCount] = await Promise.all([
    count(c.env.DB, 'SELECT COUNT(1) AS total FROM categories'),
    count(c.env.DB, 'SELECT COUNT(1) AS total FROM sites'),
    count(c.env.DB, 'SELECT COUNT(1) AS total FROM sites WHERE visible = 1'),
    count(c.env.DB, 'SELECT COUNT(1) AS total FROM users'),
    count(c.env.DB, 'SELECT COUNT(1) AS total FROM operation_logs'),
  ])

  const recentSites = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.url, s.created_at, c.name AS category_name
     FROM sites s
     LEFT JOIN categories c ON c.id = s.category_id
     ORDER BY s.created_at DESC
     LIMIT 6`,
  ).all<{ id: string; name: string; url: string; created_at: string; category_name: string | null }>()

  const recentLogs = await c.env.DB.prepare(
    `SELECT id, username, action, module, description, created_at
     FROM operation_logs
     ORDER BY created_at DESC
     LIMIT 6`,
  ).all<{ id: string; username: string | null; action: string; module: string | null; description: string | null; created_at: string }>()

  return c.json(
    ok({
      counts: {
        categories: categoryCount,
        sites: siteCount,
        visibleSites: visibleSiteCount,
        users: userCount,
        logs: logCount,
      },
      recentSites: recentSites.results || [],
      recentLogs: recentLogs.results || [],
    }),
  )
})
