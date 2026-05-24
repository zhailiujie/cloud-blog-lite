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
}

export const publicRoutes = new Hono<{ Bindings: Env }>()

publicRoutes.get('/navigation', async (c) => {
  const categoriesResult = await c.env.DB.prepare(
    `SELECT id, parent_id, name, icon, sort, level
     FROM categories
     WHERE visible = 1
     ORDER BY sort ASC, created_at ASC`,
  ).all<CategoryRow>()

  const sitesResult = await c.env.DB.prepare(
    `SELECT id, category_id, name, url, description, logo, sort
     FROM sites
     WHERE visible = 1
     ORDER BY sort ASC, created_at ASC`,
  ).all<SiteRow>()

  const sitesByCategory = new Map<string, SiteRow[]>()
  for (const site of sitesResult.results || []) {
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
