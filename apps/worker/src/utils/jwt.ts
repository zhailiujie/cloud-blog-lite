import type { Env } from '../env'

export interface JwtPayload {
  sub: string
  username: string
  role: 'admin' | 'editor' | 'viewer'
  nickname?: string
  exp: number
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function getSecretKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function getJwtSecret(env: Env): string {
  return env.JWT_SECRET || 'local-development-jwt-secret-change-before-production'
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
