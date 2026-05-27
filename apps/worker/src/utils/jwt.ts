import type { Env } from '../env'
import { fromBase64Url, toBase64Url } from './base64'

export interface JwtPayload {
  sub: string
  username: string
  role: 'admin' | 'editor' | 'viewer'
  nickname?: string
  exp: number
}



const cachedKeys = new Map<string, CryptoKey>()

async function getSecretKey(secret: string): Promise<CryptoKey> {
  const cached = cachedKeys.get(secret)
  if (cached) return cached

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  cachedKeys.set(secret, key)
  return key
}

function getJwtSecret(env: Env): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }
  return env.JWT_SECRET
}

export async function signJwt(payload: Omit<JwtPayload, 'exp'>, env: Env, maxAgeSeconds: number): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }
  const fullPayload: JwtPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  }

  const encodedHeader = toBase64Url(new TextEncoder().encode(JSON.stringify(header)))
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(fullPayload)))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const key = await getSecretKey(getJwtSecret(env))
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))

  return `${signingInput}.${toBase64Url(signature)}`
}

export async function verifyJwt(token: string, env: Env): Promise<JwtPayload | null> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`
  const key = await getSecretKey(getJwtSecret(env))
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(encodedSignature),
    new TextEncoder().encode(signingInput),
  )

  if (!valid) {
    return null
  }

  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as JwtPayload
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null
  }

  return payload
}
