import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { nowIso } from '../../utils/id'
import { ok } from '../../utils/response'
import { writeOperationLog } from '../../utils/log'

const DEFAULT_SETTINGS: Record<string, string> = {
  'site.title': 'cloud-blog-lite',
  'site.description': '轻量导航站',
  'site.footer_text': 'Powered by Cloudflare Pages + Workers',
  'site.logo_local_enabled': '0',
}

async function getSettingsMap(env: Env) {
  const rows = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string | null }>()
  const result = { ...DEFAULT_SETTINGS }
  for (const row of rows.results || []) {
    result[row.key] = row.value || ''
  }
  return result
}

export const settingRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

settingRoutes.get('/', async (c) => {
  return c.json(ok(await getSettingsMap(c.env)))
})

settingRoutes.put('/', async (c) => {
  const body = await c.req.json<Record<string, string>>().catch(() => ({}))
  const allowedKeys = new Set(['site.title', 'site.description', 'site.logo', 'site.footer_text', 'site.logo_local_enabled'])
  const time = nowIso()

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.has(key)) continue
    await c.env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
      .bind(key, String(value || ''), time)
      .run()
  }

  const currentUser = c.get('user')
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: 'update_settings',
    module: 'setting',
    description: '更新系统设置',
    detail: body,
    ip: c.req.header('CF-Connecting-IP'),
    userAgent: c.req.header('User-Agent'),
  })

  return c.json(ok(await getSettingsMap(c.env)))
})

export async function getPublicSettings(env: Env) {
  return getSettingsMap(env)
}
