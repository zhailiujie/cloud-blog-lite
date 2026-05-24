import { Hono } from 'hono'
import type { Env } from '../../env'
import type { AuthVariables } from '../../middleware/auth'
import { ok } from '../../utils/response'
import { runD1Backup } from './service'

export const backupRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

backupRoutes.post('/run', async (c) => {
  const result = await runD1Backup(c.env)
  return c.json(ok(result))
})
