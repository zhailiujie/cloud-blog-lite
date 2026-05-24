import type { Context, Next } from 'hono'
import { fail } from '../utils/response'

export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json(fail(message), 500)
  }
}
