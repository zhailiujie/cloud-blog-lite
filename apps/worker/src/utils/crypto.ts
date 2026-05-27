import { fromBase64, toBase64 } from "./base64";

const HASH_ALGORITHM = "SHA-256";
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;



// 字节常量时间比较，防止时序攻击
async function timingSafeEqual(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  if (a.length !== b.length) return false;
  // 利用 HMAC sign+verify：相同输入在同一密鑰下必然得到相同签名
  const key = await crypto.subtle.importKey(
    "raw",
    crypto.getRandomValues(new Uint8Array(32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, a);
  return crypto.subtle.verify("HMAC", key, sig, b);
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: HASH_ALGORITHM,
      salt,
      iterations,
    },
    key,
    HASH_BYTES * 8,
  );

  return toBase64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePassword(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${hash}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [type, iterationsText, saltText, expectedHash] =
    passwordHash.split("$");
  if (type !== "pbkdf2" || !iterationsText || !saltText || !expectedHash) {
    return false;
  }

  // 使用存储时的迭代次数，确保未来升级常量后旧密码仍可验证
  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  const salt = fromBase64(saltText);
  const hash = await derivePassword(password, salt, iterations);

  // 常量时间比较，防止时序攻击
  return timingSafeEqual(fromBase64(hash), fromBase64(expectedHash));
}
