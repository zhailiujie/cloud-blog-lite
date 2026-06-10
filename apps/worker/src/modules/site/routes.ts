import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { createId, nowIso } from '../../utils/id'
import { fail, ok } from '../../utils/response'
import { decryptSecret, encryptSecret } from '../../utils/secret'
import { writeOperationLog } from '../../utils/log'
import { parsePagination } from '../../utils/pagination'
import { applyTableSort, normalizeReorderBody } from '../../utils/reorder'

interface SiteRow {
  id: string
  category_id: string
  category_name?: string | null
  name: string
  url: string
  description: string | null
  logo: string | null
  account: string | null
  password_cipher: string | null
  sort: number
  is_pinned: number
  visible: number
  click_count: number
  last_clicked_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface SiteRequest {
  categoryId?: string
  name?: string
  url?: string
  description?: string
  logo?: string
  account?: string
  password?: string
  sort?: number
  isPinned?: number
  visible?: number
  tagIds?: string[]
}

interface SiteTagSummary {
  id: string
  name: string
  color: string | null
}

async function toSite(row: SiteRow, env: Env, tags: SiteTagSummary[] = []) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    url: row.url,
    description: row.description,
    logo: row.logo,
    account: row.account,
    password: await decryptSecret(row.password_cipher, env),
    sort: row.sort,
    isPinned: row.is_pinned,
    visible: row.visible,
    clickCount: row.click_count,
    lastClickedAt: row.last_clicked_at,
    tags,
    tagIds: tags.map((tag) => tag.id),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeSiteBody(body: SiteRequest | null) {
  const categoryId = body?.categoryId?.trim()
  const name = body?.name?.trim()
  const url = body?.url?.trim()

  if (!categoryId) {
    return { error: 'Category is required' }
  }
  if (!name || name.length > 128) {
    return { error: 'Site name is required and must be less than 128 characters' }
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return { error: 'Site URL must start with http:// or https://' }
  }

  return {
    value: {
      categoryId,
      name,
      url,
      description: body?.description?.trim() || '',
      logo: body?.logo?.trim() || '',
      account: body?.account?.trim() || '',
      password: body?.password || '',
      sort: Number.isFinite(body?.sort) ? Number(body?.sort) : 0,
      isPinned: body?.isPinned === 1 ? 1 : 0,
      visible: body?.visible === 0 ? 0 : 1,
      tagIds: Array.isArray(body?.tagIds) ? [...new Set(body.tagIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))] : [],
    },
  }
}


async function getTagsBySiteIds(env: Env, siteIds: string[]) {
  if (!siteIds.length) return new Map<string, SiteTagSummary[]>()

  const placeholders = siteIds.map(() => '?').join(',')
  const rows = await env.DB.prepare(
    `SELECT st.site_id, t.id, t.name, t.color
     FROM site_tags st
     INNER JOIN tags t ON t.id = st.tag_id
     WHERE st.site_id IN (${placeholders})
     ORDER BY t.sort ASC, t.created_at ASC`,
  )
    .bind(...siteIds)
    .all<SiteTagSummary & { site_id: string }>()

  const result = new Map<string, SiteTagSummary[]>()
  for (const row of rows.results || []) {
    const list = result.get(row.site_id) || []
    list.push({ id: row.id, name: row.name, color: row.color })
    result.set(row.site_id, list)
  }
  return result
}

async function validateTagIds(env: Env, tagIds: string[]) {
  if (!tagIds.length) return true

  const placeholders = tagIds.map(() => '?').join(',')
  const row = await env.DB.prepare(`SELECT COUNT(1) AS total FROM tags WHERE id IN (${placeholders})`)
    .bind(...tagIds)
    .first<{ total: number }>()
  return Number(row?.total || 0) === tagIds.length
}

async function syncSiteTags(env: Env, siteId: string, tagIds: string[]) {
  const time = nowIso()
  await env.DB.prepare('DELETE FROM site_tags WHERE site_id = ?').bind(siteId).run()
  if (!tagIds.length) return

  await env.DB.batch(tagIds.map((tagId) => env.DB.prepare(
    'INSERT INTO site_tags (site_id, tag_id, created_at) VALUES (?, ?, ?)',
  ).bind(siteId, tagId, time)))
}


export const siteRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

siteRoutes.get('/', async (c) => {
  const categoryId = c.req.query('categoryId')
  const keyword = c.req.query('keyword')?.trim()
  const visible = c.req.query('visible')
  const isPinned = c.req.query('isPinned')
  const tagId = c.req.query('tagId')
  const pagination = parsePagination((name) => c.req.query(name))

  const conditions: string[] = []
  const params: Array<string | number> = []

  if (categoryId) {
    conditions.push('s.category_id = ?')
    params.push(categoryId)
  }
  if (keyword) {
    conditions.push('(s.name LIKE ? OR s.description LIKE ? OR s.url LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  if (visible === '0' || visible === '1') {
    conditions.push('s.visible = ?')
    params.push(Number(visible))
  }
  if (isPinned === '0' || isPinned === '1') {
    conditions.push('s.is_pinned = ?')
    params.push(Number(isPinned))
  }
  if (tagId) {
    conditions.push('EXISTS (SELECT 1 FROM site_tags st WHERE st.site_id = s.id AND st.tag_id = ?)')
    params.push(tagId)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows, totalResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT s.id, s.category_id, c.name AS category_name, s.name, s.url, s.description, s.logo, s.account, s.password_cipher,
              s.sort, s.is_pinned, s.visible, s.click_count, s.last_clicked_at, s.created_by, s.created_at, s.updated_at
       FROM sites s
       LEFT JOIN categories c ON c.id = s.category_id
       ${where}
       ORDER BY s.is_pinned DESC, s.sort ASC, s.created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(...params, pagination.pageSize, pagination.offset),
    c.env.DB.prepare(
      `SELECT COUNT(1) AS total
       FROM sites s
       ${where}`,
    ).bind(...params),
  ]) as [D1Result<SiteRow>, D1Result<{ total: number }>]

  const siteRows = rows.results || []
  const tagsBySite = await getTagsBySiteIds(c.env, siteRows.map((row) => row.id))

  return c.json(ok({
    items: await Promise.all(siteRows.map((row) => toSite(row, c.env, tagsBySite.get(row.id) || []))),
    total: Number(totalResult.results?.[0]?.total || 0),
    page: pagination.page,
    pageSize: pagination.pageSize,
  }))
})

siteRoutes.post('/reorder', async (c) => {
  const body = await c.req.json().catch(() => null)
  const items = normalizeReorderBody(body)
  if (!items) {
    return c.json(fail('Invalid reorder payload', 400), 400)
  }

  await applyTableSort(c.env, 'sites', items)

  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'reorder',
    module: 'site',
    description: '调整站点排序',
    detail: { count: items.length },
  })

  return c.json(ok(true))
})


siteRoutes.get('/export', async (c) => {
  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'export',
    module: 'site',
    description: '导出站点数据',
  })

  const [categories, tags, sites, siteTags] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT id, parent_id, name, icon, sort, level, visible FROM categories ORDER BY sort ASC, created_at ASC'),
    c.env.DB.prepare('SELECT id, name, color, sort FROM tags ORDER BY sort ASC, created_at ASC'),
    c.env.DB.prepare(`SELECT s.id, s.category_id, c.name AS category_name, s.name, s.url, s.description, s.logo, s.sort, s.is_pinned, s.visible
                      FROM sites s
                      LEFT JOIN categories c ON c.id = s.category_id
                      ORDER BY s.sort ASC, s.created_at ASC`),
    c.env.DB.prepare('SELECT site_id, tag_id FROM site_tags'),
  ]) as [
    D1Result<{ id: string; parent_id: string; name: string; icon: string | null; sort: number; level: number | null; visible: number }>,
    D1Result<{ id: string; name: string; color: string | null; sort: number }>,
    D1Result<{ id: string; category_id: string; category_name: string | null; name: string; url: string; description: string | null; logo: string | null; sort: number; is_pinned: number; visible: number }>,
    D1Result<{ site_id: string; tag_id: string }>,
  ]

  return c.json(ok({
    version: 1,
    exportedAt: nowIso(),
    categories: categories.results || [],
    tags: tags.results || [],
    sites: (sites.results || []).map((site) => ({
      ...site,
      categoryName: site.category_name,
      tagIds: (siteTags.results || []).filter((item) => item.site_id === site.id).map((item) => item.tag_id),
      tagNames: (siteTags.results || [])
        .filter((item) => item.site_id === site.id)
        .map((item) => (tags.results || []).find((tag) => tag.id === item.tag_id)?.name)
        .filter(Boolean),
    })),
    siteTags: siteTags.results || [],
  }))
})

siteRoutes.post('/import', async (c) => {
  const dryRun = c.req.query('dryRun') === '1'
  const body = await c.req.json<{
    categories?: Array<{ name?: string; icon?: string | null; sort?: number; visible?: number }>
    tags?: Array<{ name?: string; color?: string | null; sort?: number }>
    sites?: Array<{ category_id?: string; categoryName?: string; name?: string; url?: string; description?: string | null; logo?: string | null; sort?: number; is_pinned?: number; visible?: number; tagIds?: string[]; tagNames?: string[] }>
  }>().catch(() => null)

  if (!body || !Array.isArray(body.sites)) {
    return c.json(fail('Invalid import payload', 400), 400)
  }

  const currentUser = c.get('user')
  const time = nowIso()
  let importedCategories = 0
  let importedTags = 0
  let importedSites = 0
  let skippedSites = 0

  const categoryMap = new Map<string, string>()
  const existingCategories = await c.env.DB.prepare('SELECT id, name FROM categories').all<{ id: string; name: string }>()
  for (const category of existingCategories.results || []) categoryMap.set(category.name, category.id)

  for (const category of body.categories || []) {
    const name = category.name?.trim()
    if (!name || categoryMap.has(name)) continue
    if (dryRun) {
      importedSites += 1
      continue
    }

    const id = createId()
    await c.env.DB.prepare(
      `INSERT INTO categories (id, parent_id, name, icon, sort, level, visible, created_by, created_at, updated_at)
       VALUES (?, '0', ?, ?, ?, NULL, ?, ?, ?, ?)`,
    )
      .bind(id, name, category.icon || '', Number(category.sort || 0), category.visible === 0 ? 0 : 1, currentUser.sub, time, time)
      .run()
    categoryMap.set(name, id)
    importedCategories += 1
  }

  const tagMap = new Map<string, string>()
  const existingTags = await c.env.DB.prepare('SELECT id, name FROM tags').all<{ id: string; name: string }>()
  for (const tag of existingTags.results || []) tagMap.set(tag.name, tag.id)

  for (const tag of body.tags || []) {
    const name = tag.name?.trim()
    if (!name || tagMap.has(name)) continue
    const id = createId()
    await c.env.DB.prepare('INSERT INTO tags (id, name, color, sort, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, name, tag.color || '', Number(tag.sort || 0), currentUser.sub, time, time)
      .run()
    tagMap.set(name, id)
    importedTags += 1
  }

  for (const site of body.sites) {
    const name = site.name?.trim()
    const url = site.url?.trim()
    if (!name || !url || !/^https?:\/\//i.test(url)) {
      skippedSites += 1
      continue
    }

    const categoryName = site.categoryName?.trim()
    let categoryId = categoryName ? categoryMap.get(categoryName) : undefined
    if (!categoryId) categoryId = categoryMap.values().next().value
    if (!categoryId) {
      skippedSites += 1
      continue
    }

    const exists = await c.env.DB.prepare('SELECT id FROM sites WHERE url = ? LIMIT 1').bind(url).first<{ id: string }>()
    if (exists) {
      skippedSites += 1
      continue
    }

    const id = createId()
    await c.env.DB.prepare(
      `INSERT INTO sites (id, category_id, name, url, description, logo, account, password_cipher, sort, is_pinned, visible, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', NULL, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, categoryId, name, url, site.description || '', site.logo || '', Number(site.sort || 0), site.is_pinned === 1 ? 1 : 0, site.visible === 0 ? 0 : 1, currentUser.sub, time, time)
      .run()

    const tagIds = [...new Set([
      ...(Array.isArray(site.tagIds) ? site.tagIds : []),
      ...(Array.isArray(site.tagNames) ? site.tagNames.map((tagName) => tagMap.get(tagName)).filter(Boolean) as string[] : []),
    ])]
    await syncSiteTags(c.env, id, tagIds)
    importedSites += 1
  }

  if (dryRun) {
    return c.json(ok({ importedCategories, importedTags, importedSites, skippedSites, dryRun: true }))
  }

  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'import',
    module: 'site',
    description: '导入站点数据',
    detail: { importedCategories, importedTags, importedSites, skippedSites },
  })

  return c.json(ok({ importedCategories, importedTags, importedSites, skippedSites, dryRun: false }))
})

siteRoutes.post('/', async (c) => {
  const body = await c.req.json<SiteRequest>().catch(() => null)
  const normalized = normalizeSiteBody(body)
  if ('error' in normalized) {
    return c.json(fail(normalized.error || 'Invalid site', 400), 400)
  }

  const category = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1')
    .bind(normalized.value.categoryId)
    .first<{ id: string }>()
  if (!category) {
    return c.json(fail('Category not found', 404), 404)
  }

  if (!(await validateTagIds(c.env, normalized.value.tagIds))) {
    return c.json(fail('Invalid tag ids', 400), 400)
  }

  const currentUser = c.get('user')
  const id = createId()
  const time = nowIso()
  const value = normalized.value
  const passwordCipher = await encryptSecret(value.password, c.env)

  await c.env.DB.prepare(
    `INSERT INTO sites (
      id, category_id, name, url, description, logo, account, password_cipher, sort, is_pinned, visible, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, value.categoryId, value.name, value.url, value.description, value.logo, value.account, passwordCipher, value.sort, value.isPinned, value.visible, currentUser.sub, time, time)
    .run()
  await syncSiteTags(c.env, id, value.tagIds)
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'create',
    module: 'site',
    description: `创建站点：${value.name}`,
    detail: { id, url: value.url, categoryId: value.categoryId, tagIds: value.tagIds },
  })

  return c.json(ok({ id, ...value, password: value.password ? '******' : '', clickCount: 0, lastClickedAt: null, tags: [], createdBy: currentUser.sub, createdAt: time, updatedAt: time }))
})

siteRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT id FROM sites WHERE id = ? LIMIT 1').bind(id).first<{ id: string }>()
  if (!exists) {
    return c.json(fail('Site not found', 404), 404)
  }

  const body = await c.req.json<SiteRequest>().catch(() => null)
  const normalized = normalizeSiteBody(body)
  if ('error' in normalized) {
    return c.json(fail(normalized.error || 'Invalid site', 400), 400)
  }

  const category = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1')
    .bind(normalized.value.categoryId)
    .first<{ id: string }>()
  if (!category) {
    return c.json(fail('Category not found', 404), 404)
  }

  const time = nowIso()
  const value = normalized.value
  const passwordCipher = value.password ? await encryptSecret(value.password, c.env) : null
  await c.env.DB.prepare(
    `UPDATE sites
     SET category_id = ?, name = ?, url = ?, description = ?, logo = ?, account = ?, password_cipher = COALESCE(?, password_cipher), sort = ?, is_pinned = ?, visible = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(value.categoryId, value.name, value.url, value.description, value.logo, value.account, passwordCipher, value.sort, value.isPinned, value.visible, time, id)
    .run()
  await syncSiteTags(c.env, id, value.tagIds)
  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'update',
    module: 'site',
    description: `更新站点：${value.name}`,
    detail: { id, url: value.url, categoryId: value.categoryId, tagIds: value.tagIds },
  })

  return c.json(ok({ id, ...value, password: value.password ? '******' : '', updatedAt: time }))
})


siteRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const oldSite = await c.env.DB.prepare('SELECT id, name, url FROM sites WHERE id = ? LIMIT 1').bind(id).first<{ id: string; name: string; url: string }>()
  const result = await c.env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run()
  if (!result.meta.changes) {
    return c.json(fail('Site not found', 404), 404)
  }

  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'delete',
    module: 'site',
    description: `删除站点：${oldSite?.name || id}`,
    detail: oldSite || { id },
  })

  return c.json(ok(true))
})
