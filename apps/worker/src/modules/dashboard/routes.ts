import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { ok } from '../../utils/response'

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

interface CountRow {
  total: number
}

function total(result: D1Result<CountRow>) {
  return Number(result.results?.[0]?.total || 0)
}

dashboardRoutes.get('/stats', async (c) => {
  const [
    categoryCountResult,
    siteCountResult,
    visibleSiteCountResult,
    userCountResult,
    logCountResult,
    recentSites,
    recentLogs,
  ] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM categories'),
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM sites'),
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM sites WHERE visible = 1'),
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM users'),
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM operation_logs'),
    c.env.DB.prepare(
      `SELECT s.id, s.name, s.url, s.created_at, c.name AS category_name
       FROM sites s
       LEFT JOIN categories c ON c.id = s.category_id
       ORDER BY s.created_at DESC
       LIMIT 6`,
    ),
    c.env.DB.prepare(
      `SELECT id, username, action, module, description, created_at
       FROM operation_logs
       ORDER BY created_at DESC
       LIMIT 6`,
    ),
  ]) as [
    D1Result<CountRow>,
    D1Result<CountRow>,
    D1Result<CountRow>,
    D1Result<CountRow>,
    D1Result<CountRow>,
    D1Result<{ id: string; name: string; url: string; created_at: string; category_name: string | null }>,
    D1Result<{ id: string; username: string | null; action: string; module: string | null; description: string | null; created_at: string }>,
  ]

  return c.json(
    ok({
      counts: {
        categories: total(categoryCountResult),
        sites: total(siteCountResult),
        visibleSites: total(visibleSiteCountResult),
        users: total(userCountResult),
        logs: total(logCountResult),
      },
      recentSites: recentSites.results || [],
      recentLogs: recentLogs.results || [],
    }),
  )
})
