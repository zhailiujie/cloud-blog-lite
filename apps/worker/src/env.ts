export interface Env {
  APP_NAME: string
  JWT_SECRET?: string
  SITE_SECRET?: string
  COOKIE_NAME?: string
  DB: D1Database
  R2: R2Bucket
}
