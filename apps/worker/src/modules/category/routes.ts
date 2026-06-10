import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { createId, nowIso } from '../../utils/id'
import { fail, ok } from '../../utils/response'
import { parsePagination } from '../../utils/pagination'
import { applyTableSort, normalizeReorderBody } from '../../utils/reorder'
import { writeOperationLog } from '../../utils/log'

interface CategoryRow {
  id: string
  parent_id: string
  name: string
  icon: string | null
  sort: number
  level: number | null
  visible: number
  created_by: string | null
  created_at: string
  updated_at: string
}

interface CategoryRequest {
  parentId?: string
  name?: string
  icon?: string
  sort?: number
  level?: number
  visible?: number
}

function toCategory(row: CategoryRow) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    icon: row.icon,
    sort: row.sort,
    level: row.level,
    visible: row.visible,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeCategoryBody(body: CategoryRequest | null) {
  const name = body?.name?.trim()
  if (!name || name.length > 64) {
    return { error: 'Category name is required and must be at most 64 characters' }
  }

  return {
    value: {
      parentId: body?.parentId?.trim() || '0',
      name,
      icon: body?.icon?.trim() || '',
      sort: Number.isFinite(body?.sort) ? Number(body?.sort) : 0,
      level: Number.isFinite(body?.level) ? Number(body?.level) : null,
      visible: body?.visible === 0 ? 0 : 1,
    },
  }
}

async function wouldCreateCycle(env: Env, id: string, parentId: string) {
  if (!parentId || parentId === '0') return false

  let currentParentId = parentId
  const visited = new Set<string>()
  for (let depth = 0; depth < 100; depth += 1) {
    if (currentParentId === id) return true
    if (visited.has(currentParentId)) return true
    visited.add(currentParentId)

    const row = await env.DB.prepare('SELECT parent_id FROM categories WHERE id = ? LIMIT 1')
      .bind(currentParentId)
      .first<{ parent_id: string }>()
    if (!row || !row.parent_id || row.parent_id === '0') return false
    currentParentId = row.parent_id
  }

  return true
}

export const categoryRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

categoryRoutes.get('/', async (c) => {
  const pagination = parsePagination((name) => c.req.query(name))
  const [rows, totalResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, parent_id, name, icon, sort, level, visible, created_by, created_at, updated_at
       FROM categories
       ORDER BY sort ASC, created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(pagination.pageSize, pagination.offset),
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM categories'),
  ]) as [D1Result<CategoryRow>, D1Result<{ total: number }>]

  return c.json(ok({
    items: (rows.results || []).map(toCategory),
    total: Number(totalResult.results?.[0]?.total || 0),
    page: pagination.page,
    pageSize: pagination.pageSize,
  }))
})

categoryRoutes.get('/options', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, parent_id, name, icon, sort, level, visible, created_by, created_at, updated_at
     FROM categories
     ORDER BY sort ASC, created_at DESC`,
  ).all<CategoryRow>()

  return c.json(ok((rows.results || []).map(toCategory)))
})

categoryRoutes.post('/reorder', async (c) => {
  const body = await c.req.json().catch(() => null)
  const items = normalizeReorderBody(body)
  if (!items) {
    return c.json(fail('Invalid reorder payload', 400), 400)
  }

  await applyTableSort(c.env, 'categories', items)

  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'reorder',
    module: 'category',
    description: '调整分类排序',
    detail: { count: items.length },
  })

  return c.json(ok(true))
})

categoryRoutes.post('/', async (c) => {
  const body = await c.req.json<CategoryRequest>().catch(() => null)
  const normalized = normalizeCategoryBody(body)
  if ('error' in normalized) {
    return c.json(fail(normalized.error || 'Invalid category', 400), 400)
  }

  const currentUser = c.get('user')
  const id = createId()
  const time = nowIso()
  const value = normalized.value

  if (value.parentId !== '0') {
    const parent = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1')
      .bind(value.parentId)
      .first<{ id: string }>()
    if (!parent) {
      return c.json(fail('Parent category not found', 400), 400)
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO categories (
      id, parent_id, name, icon, sort, level, visible, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, value.parentId, value.name, value.icon, value.sort, value.level, value.visible, currentUser.sub, time, time)
    .run()

  return c.json(ok({ id, ...value, createdBy: currentUser.sub, createdAt: time, updatedAt: time }))
})

categoryRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const exists = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1').bind(id).first<{ id: string }>()
  if (!exists) {
    return c.json(fail('Category not found', 404), 404)
  }

  const body = await c.req.json<CategoryRequest>().catch(() => null)
  const normalized = normalizeCategoryBody(body)
  if ('error' in normalized) {
    return c.json(fail(normalized.error || 'Invalid category', 400), 400)
  }

  const time = nowIso()
  const value = normalized.value
  if (value.parentId === id) {
    return c.json(fail('分类不能将自身设为父级', 400), 400)
  }
  if (value.parentId !== '0') {
    const parent = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1')
      .bind(value.parentId)
      .first<{ id: string }>()
    if (!parent) {
      return c.json(fail('Parent category not found', 400), 400)
    }
    if (await wouldCreateCycle(c.env, id, value.parentId)) {
      return c.json(fail('分类不能将子孙分类设为父级', 400), 400)
    }
  }

  await c.env.DB.prepare(
    `UPDATE categories
     SET parent_id = ?, name = ?, icon = ?, sort = ?, level = ?, visible = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(value.parentId, value.name, value.icon, value.sort, value.level, value.visible, time, id)
    .run()

  return c.json(ok({ id, ...value, updatedAt: time }))
})

categoryRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const child = await c.env.DB.prepare('SELECT id FROM categories WHERE parent_id = ? LIMIT 1').bind(id).first<{ id: string }>()
  if (child) {
    return c.json(fail('Cannot delete category with child categories', 400), 400)
  }

  const site = await c.env.DB.prepare('SELECT id FROM sites WHERE category_id = ? LIMIT 1').bind(id).first<{ id: string }>()
  if (site) {
    return c.json(fail('Cannot delete category with sites', 400), 400)
  }

  const result = await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
  if (!result.meta.changes) {
    return c.json(fail('Category not found', 404), 404)
  }

  return c.json(ok(true))
})
