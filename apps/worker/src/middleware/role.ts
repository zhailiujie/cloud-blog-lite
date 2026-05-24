import type { Context, Next } from 'hono'
import { fail } from '../utils/response'
import type { Env } from '../env'
import type { AuthVariables } from './auth'

export function requireRole(roles: Array<'admin' | 'editor' | 'viewer'>) {
  return async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      return c.json(fail('Forbidden', 403), 403)
    }
    await next()
  }
}
