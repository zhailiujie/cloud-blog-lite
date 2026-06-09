import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { createId, nowIso } from '../../utils/id'
import { fail, ok } from '../../utils/response'
import { parsePagination } from '../../utils/pagination'
import { writeOperationLog } from '../../utils/log'

interface TagRow {
  id: string
  name: string
  color: string | null
  sort: number
  site_count?: number
  created_by: string | null
  created_at: string
  updated_at: string
}

interface TagRequest {
  name?: string
  color?: string
  sort?: number
}

function toTag(row: TagRow) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sort: row.sort,
    siteCount: Number(row.site_count || 0),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeTagBody(body: TagRequest | null) {
  const name = body?.name?.trim()
  if (!name || name.length > 32) {
    return { error: 'Tag name is required and must be at most 32 characters' }
  }

  const color = body?.color?.trim() || ''
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: 'Tag color must be a hex color like #4f46e5' }
  }

  return {
    value: {
      name,
      color,
      sort: Number.isFinite(body?.sort) ? Number(body?.sort) : 0,
    },
  }
}

export const tagRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

tagRoutes.get('/', async (c) => {
  const pagination = parsePagination((name) => c.req.query(name))
  const [rows, totalResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT t.id, t.name, t.color, t.sort, COUNT(st.site_id) AS site_count, t.created_by, t.created_at, t.updated_at
       FROM tags t
       LEFT JOIN site_tags st ON st.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.sort ASC, t.created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(pagination.pageSize, pagination.offset),
    c.env.DB.prepare('SELECT COUNT(1) AS total FROM tags'),
  ]) as [D1Result<TagRow>, D1Result<{ total: number }>]

  return c.json(ok({
    items: (rows.results || []).map(toTag),
    total: Number(totalResult.results?.[0]?.total || 0),
    page: pagination.page,
    pageSize: pagination.pageSize,
  }))
})

tagRoutes.get('/options', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, name, color, sort, created_by, created_at, updated_at
     FROM tags
     ORDER BY sort ASC, created_at DESC`,
  ).all<TagRow>()

  return c.json(ok((rows.results || []).map(toTag)))
})

tagRoutes.post('/', async (c) => {
  const body = await c.req.json<TagRequest>().catch(() => null)
  const normalized = normalizeTagBody(body)
  if ('error' in normalized) {
    return c.json(fail(normalized.error || 'Invalid tag', 400), 400)
  }

  const exists = await c.env.DB.prepare('SELECT id FROM tags WHERE name = ? LIMIT 1')
    .bind(normalized.value.name)
    .first<{ id: string }>()
  if (exists) {
    return c.json(fail('Tag name already exists', 409), 409)
  }

  const currentUser = c.get('user')
  const id = createId()
  const time = nowIso()
  const value = normalized.value

  await c.env.DB.prepare(
    `INSERT INTO tags (id, name, color, sort, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, value.name, value.color, value.sort, currentUser.sub, time, time)
    .run()

  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'create',
    module: 'tag',
    description: `创建标签：${value.name}`,
    detail: { id, color: value.color, sort: value.sort },
  })

  return c.json(ok({ id, ...value, siteCount: 0, createdBy: currentUser.sub, createdAt: time, updatedAt: time }))
})

tagRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<TagRequest>().catch(() => null)
  const normalized = normalizeTagBody(body)
  if ('error' in normalized) {
    return c.json(fail(normalized.error || 'Invalid tag', 400), 400)
  }

  const exists = await c.env.DB.prepare('SELECT id FROM tags WHERE id = ? LIMIT 1').bind(id).first<{ id: string }>()
  if (!exists) {
    return c.json(fail('Tag not found', 404), 404)
  }

  const duplicated = await c.env.DB.prepare('SELECT id FROM tags WHERE name = ? AND id <> ? LIMIT 1')
    .bind(normalized.value.name, id)
    .first<{ id: string }>()
  if (duplicated) {
    return c.json(fail('Tag name already exists', 409), 409)
  }

  const time = nowIso()
  const value = normalized.value
  await c.env.DB.prepare(
    `UPDATE tags
     SET name = ?, color = ?, sort = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(value.name, value.color, value.sort, time, id)
    .run()

  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'update',
    module: 'tag',
    description: `更新标签：${value.name}`,
    detail: { id, color: value.color, sort: value.sort },
  })

  return c.json(ok({ id, ...value, updatedAt: time }))
})

tagRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const linked = await c.env.DB.prepare('SELECT site_id FROM site_tags WHERE tag_id = ? LIMIT 1').bind(id).first<{ site_id: string }>()
  if (linked) {
    return c.json(fail('Cannot delete tag used by sites', 400), 400)
  }

  const oldTag = await c.env.DB.prepare('SELECT id, name, color FROM tags WHERE id = ? LIMIT 1').bind(id).first<{ id: string; name: string; color: string | null }>()
  const result = await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run()
  if (!result.meta.changes) {
    return c.json(fail('Tag not found', 404), 404)
  }

  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'delete',
    module: 'tag',
    description: `删除标签：${oldTag?.name || id}`,
    detail: oldTag || { id },
  })

  return c.json(ok(true))
})
