import { Hono } from "hono";
import type { Env } from "../../env";
import type { AuthVariables } from "../../middleware/auth";
import { createId } from "../../utils/id";
import { fail, ok } from "../../utils/response";
import { writeOperationLog } from "../../utils/log";

const MAX_FILE_SIZE = 1 * 1024 * 1024;
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
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/x-icon") return "ico";
  return "bin";
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
  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json(fail("Unsupported file type", 400), 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json(fail("File size must be less than 1MB", 400), 400);
  }

  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const key = `uploads/${yyyy}/${mm}/${createId()}.${getExt(file)}`;

  await c.env.R2.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  });

  const currentUser = c.get("user");
  await writeOperationLog(c.env, {
    userId: currentUser.sub,
    username: currentUser.username,
    action: "upload",
    module: "file",
    description: "上传文件",
    detail: { key, size: file.size, type: file.type },
    ip: c.req.header("CF-Connecting-IP"),
    userAgent: c.req.header("User-Agent"),
  });

  return c.json(ok({ key, url: `/api/files/${key}` }));
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
