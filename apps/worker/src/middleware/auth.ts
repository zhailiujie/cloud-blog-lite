import type { Context, Next } from 'hono'
import { getCookie } from '../utils/cookie'
import { fail } from '../utils/response'
import { verifyJwt, type JwtPayload } from '../utils/jwt'
import type { Env } from '../env'

export interface AuthVariables {
  user: JwtPayload
}

function getCookieName(env: Env): string {
  return env.COOKIE_NAME || 'cloud_blog_token'
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
  const token = getCookie(c.req.header('Cookie'), getCookieName(c.env))
  if (!token) {
    return c.json(fail('Unauthorized', 401), 401)
  }

  const payload = await verifyJwt(token, c.env)
  if (!payload) {
    return c.json(fail('Unauthorized', 401), 401)
  }

  c.set('user', payload)
  await next()
}
