import type { Env } from "../env";
import { fromBase64, toBase64 } from "./base64";



async function getKey(env: Env) {
  if (!env.SITE_SECRET) {
    throw new Error("SITE_SECRET is not configured");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.SITE_SECRET),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(
  value: string | undefined,
  env: Env,
): Promise<string> {
  if (!value) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(env);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `aesgcm$${toBase64(iv)}$${toBase64(encrypted)}`;
}

export async function decryptSecret(
  value: string | null | undefined,
  env: Env,
): Promise<string> {
  if (!value) return "";
  const [type, ivText, dataText] = value.split("$");
  if (type !== "aesgcm" || !ivText || !dataText) return "";
  try {
    const key = await getKey(env);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivText) },
      key,
      fromBase64(dataText),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}
