import type { Env } from '../env'
import { nowIso } from './id'

export interface ReorderItem {
  id: string
  sort: number
}

export function normalizeReorderBody(body: unknown): ReorderItem[] | null {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { items?: unknown }).items)) {
    return null
  }

  const items = (body as { items: unknown[] }).items
  const result: ReorderItem[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const id = String((item as { id?: unknown }).id || '').trim()
    const sort = Number((item as { sort?: unknown }).sort)
    if (!id || !Number.isFinite(sort)) continue
    result.push({ id, sort: Math.trunc(sort) })
  }

  return result.length ? result : null
}

export async function applyTableSort(env: Env, table: 'categories' | 'sites' | 'tags', items: ReorderItem[]) {
  const time = nowIso()
  await env.DB.batch(
    items.map(({ id, sort }) =>
      env.DB.prepare(`UPDATE ${table} SET sort = ?, updated_at = ? WHERE id = ?`).bind(sort, time, id),
    ),
  )
}
