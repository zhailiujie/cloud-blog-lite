import type { Env } from '../env'

export function getDb(env: Env): D1Database {
  return env.DB
}

export function getR2(env: Env): R2Bucket {
  return env.R2
}
