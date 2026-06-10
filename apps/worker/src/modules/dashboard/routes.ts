import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { ok } from '../../utils/response'
import { parsePagination } from '../../utils/pagination'

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
    popularSites,
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
      `SELECT s.id, s.name, s.url, s.click_count, c.name AS category_name
       FROM sites s
       LEFT JOIN categories c ON c.id = s.category_id
       WHERE s.visible = 1 AND s.click_count > 0
       ORDER BY s.click_count DESC, s.created_at DESC
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
    D1Result<{ id: string; name: string; url: string; click_count: number; category_name: string | null }>,
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
      popularSites: popularSites.results || [],
      recentLogs: recentLogs.results || [],
    }),
  )
})

dashboardRoutes.get('/click-stats', async (c) => {
  const categoryId = c.req.query('categoryId')
  const keyword = c.req.query('keyword')?.trim()
  const pagination = parsePagination((name) => c.req.query(name))

  const conditions = ['s.visible = 1']
  const params: Array<string | number> = []

  if (categoryId) {
    conditions.push('s.category_id = ?')
    params.push(categoryId)
  }
  if (keyword) {
    conditions.push('(s.name LIKE ? OR s.description LIKE ? OR s.url LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  const [summaryResult, rows, totalResult, categoryStats] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(s.click_count), 0) AS total_clicks,
         SUM(CASE WHEN s.click_count > 0 THEN 1 ELSE 0 END) AS sites_with_clicks
       FROM sites s
       ${where}`,
    ).bind(...params),
    c.env.DB.prepare(
      `SELECT s.id, s.name, s.url, s.click_count, s.last_clicked_at, c.name AS category_name
       FROM sites s
       LEFT JOIN categories c ON c.id = s.category_id
       ${where}
       ORDER BY s.click_count DESC, s.last_clicked_at DESC, s.created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(...params, pagination.pageSize, pagination.offset),
    c.env.DB.prepare(
      `SELECT COUNT(1) AS total
       FROM sites s
       ${where}`,
    ).bind(...params),
    c.env.DB.prepare(
      `SELECT c.id, c.name, COALESCE(SUM(s.click_count), 0) AS click_count, COUNT(s.id) AS site_count
       FROM categories c
       LEFT JOIN sites s ON s.category_id = c.id AND s.visible = 1
       GROUP BY c.id
       HAVING click_count > 0
       ORDER BY click_count DESC, c.sort ASC
       LIMIT 8`,
    ),
  ]) as [
    D1Result<{ total_clicks: number; sites_with_clicks: number }>,
    D1Result<{ id: string; name: string; url: string; click_count: number; last_clicked_at: string | null; category_name: string | null }>,
    D1Result<{ total: number }>,
    D1Result<{ id: string; name: string; click_count: number; site_count: number }>,
  ]

  const summaryRow = summaryResult.results?.[0]

  return c.json(
    ok({
      summary: {
        totalClicks: Number(summaryRow?.total_clicks || 0),
        sitesWithClicks: Number(summaryRow?.sites_with_clicks || 0),
      },
      categoryStats: (categoryStats.results || []).map((row) => ({
        id: row.id,
        name: row.name,
        clickCount: Number(row.click_count || 0),
        siteCount: Number(row.site_count || 0),
      })),
      items: (rows.results || []).map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        clickCount: Number(row.click_count || 0),
        lastClickedAt: row.last_clicked_at,
        categoryName: row.category_name,
      })),
      total: Number(totalResult.results?.[0]?.total || 0),
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
  )
})
