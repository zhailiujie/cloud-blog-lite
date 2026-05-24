import type { Env } from '../env'

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function getKey(env: Env) {
  const secret = env.SITE_SECRET || env.JWT_SECRET || 'local-development-site-secret-change-before-production'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(value: string | undefined, env: Env): Promise<string> {
  if (!value) return ''
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getKey(env)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
  return `aesgcm$${toBase64(iv)}$${toBase64(encrypted)}`
}

export async function decryptSecret(value: string | null | undefined, env: Env): Promise<string> {
  if (!value) return ''
  const [type, ivText, dataText] = value.split('$')
  if (type !== 'aesgcm' || !ivText || !dataText) return ''
  const key = await getKey(env)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivText) }, key, fromBase64(dataText))
  return new TextDecoder().decode(decrypted)
}
