export interface Env {
  APP_NAME: string;
  JWT_SECRET?: string;
  SITE_SECRET?: string;
  RESEND_API_KEY?: string;
  BACKUP_EMAIL_FROM?: string;
  BACKUP_EMAIL_TO?: string;
  COOKIE_NAME?: string;
  DB: D1Database;
  R2: R2Bucket;
}
