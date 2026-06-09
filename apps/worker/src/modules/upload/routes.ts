import { Hono } from "hono";
import type { Env } from "../../env";
import type { AuthVariables } from "../../middleware/auth";
import { createId } from "../../utils/id";
import { fail, ok } from "../../utils/response";
import { writeOperationLog } from "../../utils/log";

const MAX_FILE_SIZE = 1 * 1024 * 1024;
const FAVICON_FETCH_TIMEOUT = 6000;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/x-icon",
  // image/svg+xml 已移除：SVG 可内嵌 JS，允许上传可导致存储型 XSS
]);

function getExt(file: File): string {
  const name = file.name || "";
  const ext = name.includes(".") ? name.split(".").pop() || "" : "";
  if (ext) return ext.toLowerCase();
  return getExtFromContentType(file.type);
}

function getExtFromContentType(contentType: string): string {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (
    normalized === "image/x-icon" ||
    normalized === "image/vnd.microsoft.icon"
  )
    return "ico";
  return "bin";
}

function normalizeImageContentType(contentType: string, url: URL): string {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  if (normalized === "image/vnd.microsoft.icon") return "image/x-icon";
  if (
    normalized === "application/octet-stream" &&
    url.pathname.toLowerCase().endsWith(".ico")
  )
    return "image/x-icon";
  return normalized;
}

function buildImageKey(directory: string, ext: string): string {
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${directory}/${yyyy}/${mm}/${createId()}.${ext}`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAVICON_FETCH_TIMEOUT);
  try {
    return await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractIconUrls(html: string, baseUrl: URL) {
  const urls: string[] = [];
  const linkPattern =
    /<link\s+[^>]*rel=["'][^"']*(?:icon|shortcut icon|apple-touch-icon)[^"']*["'][^>]*>/gi;
  const hrefPattern = /href=["']([^"']+)["']/i;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[0].match(hrefPattern)?.[1];
    if (!href) continue;
    try {
      urls.push(new URL(href, baseUrl).toString());
    } catch {
      // 忽略无效 favicon 地址
    }
  }

  return urls;
}

async function buildFaviconCandidates(siteUrl: URL) {
  const candidates: string[] = [];

  try {
    const response = await fetchWithTimeout(siteUrl.toString(), {
      headers: { "User-Agent": "cloud-blog-lite favicon fetcher" },
    });
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("text/html")) {
      const html = await response.text();
      candidates.push(...extractIconUrls(html.slice(0, 200_000), siteUrl));
    }
  } catch {
    // 页面不可抓取时继续尝试默认 favicon 路径
  }

  candidates.push(`${siteUrl.origin}/favicon.ico`);
  candidates.push(`${siteUrl.origin}/favicon.png`);
  candidates.push(`https://favicon.yandex.net/favicon/${siteUrl.host}`);

  return [...new Set(candidates)];
}

async function downloadFavicon(url: string) {
  const faviconUrl = new URL(url);
  const response = await fetchWithTimeout(faviconUrl.toString(), {
    headers: { "User-Agent": "cloud-blog-lite favicon fetcher" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const rawContentType = response.headers.get("content-type") || "";
  const contentType = normalizeImageContentType(rawContentType, faviconUrl);
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Unsupported favicon type");
  }

  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error("Invalid favicon size");
  }

  return {
    buffer,
    contentType,
    ext: getExtFromContentType(contentType),
    sourceUrl: faviconUrl.toString(),
  };
}

export const uploadRoutes = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

uploadRoutes.post("/", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file") as File | null;

  if (!file || typeof file === "string") {
    return c.json(fail("File is required", 400), 400);
  }
  const contentType = normalizeImageContentType(
    file.type,
    new URL(`https://upload.local/${file.name || "file"}`),
  );
  if (!ALLOWED_TYPES.has(contentType)) {
    return c.json(fail("Unsupported file type", 400), 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json(fail("File size must be less than 1MB", 400), 400);
  }

  const key = buildImageKey("uploads", getExt(file));
  await c.env.R2.put(key, file.stream(), {
    httpMetadata: {
      contentType,
    },
  });

  const currentUser = c.get("user");
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: "upload",
    module: "file",
    description: "上传文件",
    detail: { key, size: file.size, type: contentType },
    ip: c.req.header("CF-Connecting-IP"),
    userAgent: c.req.header("User-Agent"),
  });

  return c.json(ok({ key, url: `/api/files/${key}` }));
});

uploadRoutes.post("/favicon", async (c) => {
  const body = await c.req.json<{ url?: string }>().catch(() => null);
  const value = body?.url?.trim();
  if (!value || !/^https?:\/\//i.test(value)) {
    return c.json(fail("Valid site URL is required", 400), 400);
  }

  const siteUrl = new URL(value);
  const candidates = await buildFaviconCandidates(siteUrl);
  let favicon: Awaited<ReturnType<typeof downloadFavicon>> | null = null;
  let lastError = "";

  for (const candidate of candidates) {
    try {
      favicon = await downloadFavicon(candidate);
      break;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "favicon fetch failed";
    }
  }

  if (!favicon) {
    return c.json(
      fail(`Favicon not found: ${lastError || "no valid candidates"}`, 404),
      404,
    );
  }

  const key = buildImageKey("favicons", favicon.ext);
  await c.env.R2.put(key, favicon.buffer, {
    httpMetadata: {
      contentType: favicon.contentType,
    },
  });

  const currentUser = c.get("user");
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: "fetch-favicon",
    module: "file",
    description: "自动获取 favicon 并保存到 R2",
    detail: {
      key,
      siteUrl: siteUrl.toString(),
      sourceUrl: favicon.sourceUrl,
      size: favicon.buffer.byteLength,
      type: favicon.contentType,
    },
    ip: c.req.header("CF-Connecting-IP"),
    userAgent: c.req.header("User-Agent"),
  });

  return c.json(
    ok({ key, url: `/api/files/${key}`, sourceUrl: favicon.sourceUrl }),
  );
});

function getFileKeyFromPath(pathname: string): string {
  const marker = "/files/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) return "";

  const key = pathname.slice(markerIndex + marker.length);
  try {
    return decodeURIComponent(key);
  } catch {
    return "";
  }
}

export const fileRoutes = new Hono<{ Bindings: Env }>();

fileRoutes.get("/*", async (c) => {
  const key = getFileKeyFromPath(new URL(c.req.url).pathname);
  if (!key) {
    return c.json(fail("File key is required", 400), 400);
  }

  // 拒绝访问备份目录，防止数据库快照被公开下载
  if (key.startsWith("backups/")) {
    return c.json(fail("Not found", 404), 404);
  }

  const object = await c.env.R2.get(key);
  if (!object) {
    return c.json(fail("File not found", 404), 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000");

  return new Response(object.body, { headers });
});
