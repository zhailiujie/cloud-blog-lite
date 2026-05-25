import type { Env } from "../../env";

const TABLES = ["users", "categories", "sites", "settings"] as const;

export interface BackupResult {
  ok: boolean;
  key: string;
  fileName: string;
  bytes: number;
  tableCounts: Record<string, number>;
  email: {
    enabled: boolean;
    sent: boolean;
    error?: string;
  };
  createdAt: string;
}

interface R2ObjectSnapshot {
  key: string;
  size: number;
  etag: string;
  uploaded: string;
  httpEtag?: string;
  customMetadata?: Record<string, string>;
}

interface BackupPayload {
  app: string;
  version: 1;
  created_at: string;
  tables: Record<string, unknown[]>;
  r2_objects: R2ObjectSnapshot[];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: pad(date.getUTCMonth() + 1),
    day: pad(date.getUTCDate()),
    hour: pad(date.getUTCHours()),
    minute: pad(date.getUTCMinutes()),
    second: pad(date.getUTCSeconds()),
  };
}

function buildBackupKey(date: Date): { key: string; fileName: string } {
  const { year, month, day, hour, minute, second } = formatDateParts(date);
  const stamp = `${year}-${month}-${day}T${hour}-${minute}-${second}Z`;
  const fileName = `cloud-blog-lite-d1-${stamp}.json.gz`;
  return {
    key: `backups/d1/daily/${year}-${month}-${day}/${fileName}`,
    fileName,
  };
}

async function readTable(env: Env, table: string): Promise<unknown[]> {
  const result = await env.DB.prepare(`SELECT * FROM ${table}`).all();
  return result.results || [];
}

async function listR2Objects(env: Env): Promise<R2ObjectSnapshot[]> {
  const objects: R2ObjectSnapshot[] = [];
  let cursor: string | undefined;

  do {
    const result = await env.R2.list({ cursor });
    for (const object of result.objects) {
      objects.push({
        key: object.key,
        size: object.size,
        etag: object.etag,
        uploaded: object.uploaded.toISOString(),
        httpEtag: object.httpEtag,
        customMetadata: object.customMetadata,
      });
    }
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);

  return objects;
}

async function gzipJson(payload: BackupPayload): Promise<Uint8Array> {
  const json = JSON.stringify(payload, null, 2);
  const stream = new Blob([json], { type: "application/json" })
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function sendBackupEmail(
  env: Env,
  fileName: string,
  bytes: Uint8Array,
  tableCounts: Record<string, number>,
) {
  if (!env.RESEND_API_KEY || !env.BACKUP_EMAIL_FROM || !env.BACKUP_EMAIL_TO) {
    return {
      enabled: false,
      sent: false,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.BACKUP_EMAIL_FROM,
      to: [env.BACKUP_EMAIL_TO],
      subject: `cloud-blog-lite D1 backup ${fileName}`,
      text: [
        "cloud-blog-lite D1 backup has been generated.",
        "",
        `File: ${fileName}`,
        `Size: ${bytes.byteLength} bytes`,
        "",
        "Table counts:",
        ...Object.entries(tableCounts).map(
          ([table, count]) => `- ${table}: ${count}`,
        ),
      ].join("\n"),
      attachments: [
        {
          filename: fileName,
          content: uint8ToBase64(bytes),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      enabled: true,
      sent: false,
      error: `Resend API failed: ${response.status} ${errorText}`,
    };
  }

  return {
    enabled: true,
    sent: true,
  };
}

export async function runD1Backup(
  env: Env,
  now = new Date(),
): Promise<BackupResult> {
  const tables: Record<string, unknown[]> = {};
  const tableCounts: Record<string, number> = {};

  for (const table of TABLES) {
    const rows = await readTable(env, table);
    tables[table] = rows;
    tableCounts[table] = rows.length;
  }

  const r2Objects = await listR2Objects(env);
  const createdAt = now.toISOString();
  const payload: BackupPayload = {
    app: env.APP_NAME || "cloud-blog-lite-worker",
    version: 1,
    created_at: createdAt,
    tables,
    r2_objects: r2Objects,
  };

  const compressed = await gzipJson(payload);
  const { key, fileName } = buildBackupKey(now);

  await env.R2.put(key, compressed, {
    httpMetadata: {
      contentType: "application/gzip",
      contentDisposition: `attachment; filename="${fileName}"`,
    },
    customMetadata: {
      created_at: createdAt,
      kind: "d1-json-gzip",
      tables: TABLES.join(","),
    },
  });

  const email = await sendBackupEmail(env, fileName, compressed, tableCounts);

  return {
    ok: true,
    key,
    fileName,
    bytes: compressed.byteLength,
    tableCounts,
    email,
    createdAt,
  };
}
