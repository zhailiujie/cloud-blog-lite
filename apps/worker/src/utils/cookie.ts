import type { Env } from '../env'

export function getCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

export function getCookieName(env: Env): string {
  return env.COOKIE_NAME || 'cloud_blog_token'
}

export function createCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Strict; Secure`;
}

export function clearCookie(name: string): string {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict; Secure`;
}
