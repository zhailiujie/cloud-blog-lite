import type { Env } from '../env'
import { createId, nowIso } from './id'

export async function writeOperationLog(env: Env, params: {
  userId?: string
  username?: string
  action: string
  module?: string
  description?: string
  detail?: unknown
  ip?: string
  userAgent?: string
}) {
  try {
    await env.DB.prepare(
    `INSERT INTO operation_logs (
      id, user_id, username, action, module, description, detail, ip, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      createId(),
      params.userId || null,
      params.username || null,
      params.action,
      params.module || null,
      params.description || null,
      params.detail ? JSON.stringify(params.detail) : null,
      params.ip || null,
      params.userAgent || null,
      nowIso(),
    )
    .run()
  } catch (error) {
    console.error('Failed to write operation log', error)
  }
}
