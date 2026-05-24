const HASH_ALGORITHM = 'SHA-256'
const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function derivePassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: HASH_ALGORITHM,
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    HASH_BYTES * 8,
  )

  return toBase64(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derivePassword(password, salt)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${hash}`
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [type, iterationsText, saltText, expectedHash] = passwordHash.split('$')
  if (type !== 'pbkdf2' || !iterationsText || !saltText || !expectedHash) {
    return false
  }

  const salt = fromBase64(saltText)
  const hash = await derivePassword(password, salt)
  return hash === expectedHash
}
