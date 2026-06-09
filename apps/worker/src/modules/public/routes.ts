import { Hono } from 'hono'
import type { Env } from '../../env'
import { ok } from '../../utils/response'
import { getPublicSettings } from '../setting/routes'

interface CategoryRow {
  id: string
  parent_id: string
  name: string
  icon: string | null
  sort: number
  level: number | null
}

interface SiteRow {
  id: string
  category_id: string
  name: string
  url: string
  description: string | null
  logo: string | null
  sort: number
  is_pinned: number
  click_count: number
}

interface PublicTagSummary {
  id: string
  name: string
  color: string | null
}

async function getTagsBySiteIds(env: Env, siteIds: string[]) {
  if (!siteIds.length) return new Map<string, PublicTagSummary[]>()

  const placeholders = siteIds.map(() => '?').join(',')
  const rows = await env.DB.prepare(
    `SELECT st.site_id, t.id, t.name, t.color
     FROM site_tags st
     INNER JOIN tags t ON t.id = st.tag_id
     WHERE st.site_id IN (${placeholders})
     ORDER BY t.sort ASC, t.created_at ASC`,
  )
    .bind(...siteIds)
    .all<PublicTagSummary & { site_id: string }>()

  const result = new Map<string, PublicTagSummary[]>()
  for (const row of rows.results || []) {
    const list = result.get(row.site_id) || []
    list.push({ id: row.id, name: row.name, color: row.color })
    result.set(row.site_id, list)
  }
  return result
}

export const publicRoutes = new Hono<{ Bindings: Env }>()


publicRoutes.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

publicRoutes.get('/navigation', async (c) => {
  const categoriesResult = await c.env.DB.prepare(
    `SELECT id, parent_id, name, icon, sort, level
     FROM categories
     WHERE visible = 1
       AND EXISTS (
         SELECT 1
         FROM sites
         WHERE sites.category_id = categories.id
           AND sites.visible = 1
       )
     ORDER BY sort ASC, created_at ASC`,
  ).all<CategoryRow>()

  const sitesResult = await c.env.DB.prepare(
    `SELECT id, category_id, name, url, description, logo, sort, is_pinned, click_count
     FROM sites
     WHERE visible = 1
     ORDER BY is_pinned DESC, sort ASC, created_at ASC`,
  ).all<SiteRow>()

  const siteRows = sitesResult.results || []
  const tagsBySite = await getTagsBySiteIds(c.env, siteRows.map((site) => site.id))

  const sitesByCategory = new Map<string, SiteRow[]>()
  for (const site of siteRows) {
    const list = sitesByCategory.get(site.category_id) || []
    list.push(site)
    sitesByCategory.set(site.category_id, list)
  }

  const categories = (categoriesResult.results || []).map((category) => ({
    id: category.id,
    parentId: category.parent_id,
    name: category.name,
    icon: category.icon,
    sort: category.sort,
    level: category.level,
    sites: (sitesByCategory.get(category.id) || []).map((site) => ({
      id: site.id,
      categoryId: site.category_id,
      name: site.name,
      url: site.url,
      description: site.description,
      logo: site.logo,
      sort: site.sort,
      isPinned: site.is_pinned,
      clickCount: site.click_count,
      tags: tagsBySite.get(site.id) || [],
    })),
  }))

  const settings = await getPublicSettings(c.env)

  return c.json(
    ok({
      settings: {
        title: settings['site.title'] || 'cloud-blog-lite',
        description: settings['site.description'] || '轻量导航站',
        logo: settings['site.logo'] || '',
        footerText: settings['site.footer_text'] || 'Powered by Cloudflare Pages + Workers',
      },
      categories,
    }),
  )
})

publicRoutes.post('/sites/:id/click', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare(
    `UPDATE sites
     SET click_count = click_count + 1, last_clicked_at = ?
     WHERE id = ? AND visible = 1`,
  )
    .bind(new Date().toISOString(), id)
    .run()

  return c.json(ok(true))
})
