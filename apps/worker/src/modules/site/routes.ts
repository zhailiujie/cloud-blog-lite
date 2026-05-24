import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { createId, nowIso } from '../../utils/id'
import { fail, ok } from '../../utils/response'
import { decryptSecret, encryptSecret } from '../../utils/secret'

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
  visible: number
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
  visible?: number
}

async function toSite(row: SiteRow, env: Env) {
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
    visible: row.visible,
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
      visible: body?.visible === 0 ? 0 : 1,
    },
  }
}

export const siteRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

siteRoutes.get('/', async (c) => {
  const categoryId = c.req.query('categoryId')
  const keyword = c.req.query('keyword')?.trim()
  const visible = c.req.query('visible')

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

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.category_id, c.name AS category_name, s.name, s.url, s.description, s.logo, s.account, s.password_cipher,
            s.sort, s.visible, s.created_by, s.created_at, s.updated_at
     FROM sites s
     LEFT JOIN categories c ON c.id = s.category_id
     ${where}
     ORDER BY s.sort ASC, s.created_at DESC`,
  )
    .bind(...params)
    .all<SiteRow>()

  return c.json(ok(await Promise.all((rows.results || []).map((row) => toSite(row, c.env)))))
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

  const currentUser = c.get('user')
  const id = createId()
  const time = nowIso()
  const value = normalized.value
  const passwordCipher = await encryptSecret(value.password, c.env)

  await c.env.DB.prepare(
    `INSERT INTO sites (
      id, category_id, name, url, description, logo, account, password_cipher, sort, visible, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, value.categoryId, value.name, value.url, value.description, value.logo, value.account, passwordCipher, value.sort, value.visible, currentUser.sub, time, time)
    .run()

  return c.json(ok({ id, ...value, password: value.password ? '******' : '', createdBy: currentUser.sub, createdAt: time, updatedAt: time }))
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
     SET category_id = ?, name = ?, url = ?, description = ?, logo = ?, account = ?, password_cipher = COALESCE(?, password_cipher), sort = ?, visible = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(value.categoryId, value.name, value.url, value.description, value.logo, value.account, passwordCipher, value.sort, value.visible, time, id)
    .run()

  return c.json(ok({ id, ...value, password: value.password ? '******' : '', updatedAt: time }))
})

siteRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const result = await c.env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run()
  if (!result.meta.changes) {
    return c.json(fail('Site not found', 404), 404)
  }

  return c.json(ok(true))
})
