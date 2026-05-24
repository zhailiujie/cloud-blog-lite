# 备份与恢复说明

本文档记录 `cloud-blog-lite` 的线上数据备份与恢复方案。

## 1. 当前备份范围

当前自动备份会导出 D1 中的核心业务表：

```text
users
categories
sites
settings
operation_logs
```

备份内容会被序列化为 JSON，并使用 gzip 压缩。

## 2. 备份文件位置

备份文件保存到 Cloudflare R2 Bucket：

```text
cloud-blog-lite-files
```

路径格式：

```text
backups/d1/daily/YYYY-MM-DD/cloud-blog-lite-d1-YYYY-MM-DDTHH-mm-ssZ.json.gz
```

示例：

```text
backups/d1/daily/2026-05-24/cloud-blog-lite-d1-2026-05-24T17-00-00Z.json.gz
```

## 3. 自动备份时间

Cloudflare Cron 使用 UTC 时间。

当前配置：

```toml
[triggers]
crons = ["0 17 * * *"]
```

含义：

```text
每天 UTC 17:00 执行
等于北京时间 UTC+8 每天凌晨 01:00 执行
```

## 4. 手动触发备份

管理员登录后，可以调用：

```http
POST /api/admin/backups/run
```

例如在浏览器已登录 `https://blog.***.com` 后，可以通过开发者工具 Console 执行：

```js
fetch('/api/admin/backups/run', { method: 'POST', credentials: 'include' })
  .then((res) => res.json())
  .then(console.log)
```

成功响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "ok": true,
    "key": "backups/d1/daily/2026-05-24/cloud-blog-lite-d1-2026-05-24T17-00-00Z.json.gz",
    "fileName": "cloud-blog-lite-d1-2026-05-24T17-00-00Z.json.gz",
    "bytes": 1024,
    "tableCounts": {
      "users": 1,
      "categories": 0,
      "sites": 0,
      "settings": 0,
      "operation_logs": 0
    },
    "email": {
      "enabled": false,
      "sent": false
    },
    "createdAt": "2026-05-24T17:00:00.000Z"
  }
}
```

## 5. 邮件发送

当前代码已预留通过 Resend API 将 gzip 备份作为附件发送到：

```text
***@***.com
```

但邮件发送需要额外配置：

```text
RESEND_API_KEY
BACKUP_EMAIL_FROM
BACKUP_EMAIL_TO
```

其中：

- `RESEND_API_KEY`：Resend API Key，必须通过 Cloudflare Worker Secret 配置；
- `BACKUP_EMAIL_FROM`：Resend 中已验证的发件人，例如 `cloud-blog-lite <backup@example.com>`；
- `BACKUP_EMAIL_TO`：收件人，当前已配置为 `***@***.com`。

配置示例：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put RESEND_API_KEY
```

`BACKUP_EMAIL_FROM` 可以配置在 `wrangler.toml` 的 `[vars]` 中，或作为 secret 配置。

注意：

- 不要把 `RESEND_API_KEY` 写入 Git；
- Resend 需要验证发件域名或发件地址；
- 如果未配置 `RESEND_API_KEY` 或 `BACKUP_EMAIL_FROM`，备份仍会保存到 R2，但不会发送邮件。

## 6. 查看备份文件

可以在 Cloudflare Dashboard 中查看：

```text
R2 Object Storage
→ cloud-blog-lite-files
→ backups/d1/daily/
```

也可以用 Wrangler 查看对象列表：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler r2 object list cloud-blog-lite-files --prefix backups/d1/daily/
```

## 7. 恢复思路

当前备份格式是 gzip 压缩后的 JSON，而不是直接可执行 SQL。

恢复步骤：

```text
1. 从 R2 下载 `.json.gz` 备份文件
2. 解压得到 JSON
3. 检查 JSON 中的 tables 字段
4. 按表清理或导入数据
5. 先恢复 users/categories/sites/settings
6. 最后按需恢复 operation_logs
7. 验证前台导航、后台登录、分类、站点、设置是否正常
```

## 8. 重要安全说明

`sites.password_cipher` 中保存的是加密后的站点密码。

恢复数据时必须同时保证生产环境 `SITE_SECRET` 与原环境一致，否则旧站点密码可能无法解密。

因此必须长期保存：

```text
SITE_SECRET
```

不要把它提交到 GitHub。
