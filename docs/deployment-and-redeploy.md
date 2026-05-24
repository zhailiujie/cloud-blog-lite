# Cloudflare 部署与后续重新部署步骤

本文档记录 `cloud-blog-lite` 从 GitHub 到 Cloudflare 的完整部署流程，以及后续修改代码后的重新部署方式。

为避免泄露敏感信息，文档中的域名、邮箱、数据库 ID、Secret 值均使用占位符表示：

```text
访问域名：blog.***.com
根域名：***.com
邮箱：***@***.com
D1 database_id：<D1_DATABASE_ID>
Secret：<SECRET_VALUE>
Worker Version ID：<WORKER_VERSION_ID>
```

不要把真实 Secret、API Key、数据库 ID、个人邮箱、账号密码写入文档或提交到 GitHub。

## 1. 当前线上架构

```text
用户浏览器
  │
  ▼
https://blog.***.com
  │
  ├── Cloudflare Pages：Vue 3 前端
  │
  └── /api/*
        │
        ▼
      Cloudflare Worker：Hono API
        │
        ├── Cloudflare D1：核心数据
        └── Cloudflare R2：上传文件、备份文件
```

当前访问方式：

```text
https://blog.***.com              前端页面
https://blog.***.com/api/*        Worker API
```

推荐使用同域 API，避免跨域 Cookie 问题。

## 2. GitHub 准备

### 2.1 初始化仓库

```bash
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:<your-account>/<repo>.git
git push -u origin main
```

### 2.2 `.gitignore` 要求

必须忽略：

```text
node_modules/
dist/
.wrangler/
.env
.env.*
*.log
logs/
coverage/
```

不要上传：

```text
本地依赖
构建产物
本地 Wrangler 状态
日志
环境变量文件
Secret/API Key
```

## 3. Cloudflare 登录

在项目根目录执行：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler login
```

验证登录状态：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler whoami
```

文档中只记录“已登录并具备权限”，不要记录真实账号邮箱。

## 4. 创建 Cloudflare 资源

### 4.1 创建 D1 数据库

可以通过 Cloudflare Dashboard 创建：

```text
Workers & Pages → D1 SQL Database → Create database
```

数据库名建议：

```text
cloud-blog-lite
```

创建后拿到：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloud-blog-lite"
database_id = "<D1_DATABASE_ID>"
```

将真实 `database_id` 写入：

```text
apps/worker/wrangler.toml
```

注意：公开文档中必须写成：

```text
<D1_DATABASE_ID>
```

### 4.2 创建 R2 Bucket

可以通过 Cloudflare Dashboard 创建：

```text
R2 Object Storage → Create bucket
```

Bucket 名称：

```text
cloud-blog-lite-files
```

`wrangler.toml` 中配置：

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "cloud-blog-lite-files"
```

## 5. 配置 Worker Secret

需要配置以下 Secret：

```text
JWT_SECRET
SITE_SECRET
RESEND_API_KEY，可选，用于备份邮件
```

### 5.1 JWT_SECRET

用途：登录 JWT 签名。

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put JWT_SECRET
```

如果更换该值，已登录用户会失效，需要重新登录。

### 5.2 SITE_SECRET

用途：站点密码 AES-GCM 加密/解密。

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put SITE_SECRET
```

重要：

```text
SITE_SECRET 必须长期保存到密码管理器。
如果丢失，历史加密站点密码可能无法解密。
```

### 5.3 RESEND_API_KEY

用途：通过 Resend 发送备份邮件。

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put RESEND_API_KEY
```

不要把 API Key 写入：

```text
GitHub
README
docs
.env
聊天记录
截图
```

如果 API Key 泄露，应立即在 Resend 后台删除并重新生成。

## 6. 配置 Worker 变量和 Cron

`apps/worker/wrangler.toml` 示例：

```toml
name = "cloud-blog-lite-api"
main = "src/index.ts"
compatibility_date = "2024-06-01"
routes = [
  { pattern = "blog.***.com/api/*", zone_name = "***.com" }
]

[vars]
APP_NAME = "cloud-blog-lite-worker"
COOKIE_NAME = "cloud_blog_token"
BACKUP_EMAIL_TO = "***@***.com"
BACKUP_EMAIL_FROM = "cloud-blog-lite <backup@***.com>"

[triggers]
# Cloudflare Cron 使用 UTC。17:00 UTC 等于北京时间 01:00。
crons = ["0 17 * * *"]

[[d1_databases]]
binding = "DB"
database_name = "cloud-blog-lite"
database_id = "<D1_DATABASE_ID>"

[[r2_buckets]]
binding = "R2"
bucket_name = "cloud-blog-lite-files"
```

## 7. 执行远程 D1 Migration

```bash
pnpm d1:migrate:remote
```

预期结果：

```text
0001_initial.sql 执行成功
远程 D1 创建 users/categories/sites/settings/operation_logs 等表
```

## 8. 部署 Worker

```bash
pnpm deploy:worker
```

如果遇到 pnpm 9 内置 `deploy` 命令冲突，根项目脚本应使用：

```json
{
  "deploy:worker": "pnpm --filter @cloud-blog-lite/worker run deploy"
}
```

部署成功后会显示：

```text
blog.***.com/api/*
schedule: 0 17 * * *
Current Version ID: <WORKER_VERSION_ID>
```

验证健康检查：

```text
https://blog.***.com/api/health
```

应返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "UP"
  }
}
```

## 9. 部署 Cloudflare Pages 前端

### 9.1 手动命令部署

先构建：

```bash
pnpm build:web
```

再部署：

```bash
pnpm --dir apps/worker exec wrangler pages project create cloud-blog-lite --production-branch main
pnpm --dir apps/worker exec wrangler pages deploy ../web/dist --project-name cloud-blog-lite --branch main --commit-dirty=true
```

### 9.2 GitHub 集成部署

也可以在 Cloudflare Pages 中连接 GitHub 仓库：

```text
Workers & Pages → Pages → Create project → Connect to Git
```

建议配置：

```text
Root directory: /
Build command: pnpm build:web
Build output directory: apps/web/dist
Environment variable: VITE_API_BASE=/api
```

## 10. 绑定访问域名

在 Cloudflare Pages 中绑定：

```text
blog.***.com
```

位置：

```text
Workers & Pages → Pages → cloud-blog-lite → Custom domains
```

DNS 推荐：

```text
Type: CNAME
Name: blog
Target: <pages-project>.***.com
Proxy: Proxied
```

Worker Route：

```text
blog.***.com/api/*
```

验证：

```text
https://blog.***.com
https://blog.***.com/api/health
```

## 11. 初始化线上管理员

检查初始化状态：

```text
GET https://blog.***.com/api/setup/status
```

如果返回：

```json
{
  "initialized": false
}
```

创建第一个管理员：

```powershell
Invoke-RestMethod `
  -Uri "https://blog.***.com/api/setup/admin" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"<STRONG_PASSWORD>","nickname":"超级管理员"}'
```

注意：

```text
不要把真实管理员密码写入文档或截图。
```

## 12. 上线验证清单

部署后必须验证：

```text
1. https://blog.***.com 可打开
2. https://blog.***.com/api/health 返回 status: UP
3. 可以初始化 admin
4. 可以登录后台
5. 用户管理页可打开
6. 分类管理可新增/编辑/删除
7. 站点管理可新增/编辑/删除
8. 前台导航页展示后台数据
9. 上传功能可用
10. 系统设置可保存
11. 操作日志可查询
12. 手动备份可生成 R2 文件
13. Cron 已部署，每天凌晨 1 点自动备份
14. 邮件发送状态以 Resend 日志和收件邮箱为准
```

## 13. 备份配置

当前备份能力：

```text
每天北京时间 01:00 自动执行
导出 D1 核心表
生成 gzip 压缩 JSON
上传到 R2
记录 R2 文件清单
可选发送邮件通知/附件
```

手动触发：

```js
fetch('/api/admin/backups/run', { method: 'POST', credentials: 'include' })
  .then((res) => res.json())
  .then(console.log)
```

R2 路径：

```text
backups/d1/daily/YYYY-MM-DD/cloud-blog-lite-d1-YYYY-MM-DDTHH-mm-ssZ.json.gz
```

邮件发送注意事项：

```text
1. Resend API 成功只表示发信服务已接收请求，不等于收件箱已收到。
2. 实际投递状态以 Resend Logs 和收件邮箱为准。
3. 某些邮箱可能拦截 .gz 附件。
4. 待处理优化：如果附件投递不稳定，可改为只发送备份摘要和 R2 路径，不带附件。
```

## 14. 后续修改代码后的重新部署步骤

### 14.1 修改前同步代码

```bash
git pull
pnpm install
```

### 14.2 修改前端代码后

例如修改：

```text
apps/web/src/**
```

验证：

```bash
pnpm build:web
```

部署 Pages：

```bash
pnpm --dir apps/worker exec wrangler pages deploy ../web/dist --project-name cloud-blog-lite --branch main --commit-dirty=true
```

提交：

```bash
git add apps/web docs README.md package.json pnpm-lock.yaml
git commit -m "feat: update web"
git push
```

### 14.3 修改 Worker 代码后

例如修改：

```text
apps/worker/src/**
apps/worker/wrangler.toml
apps/worker/migrations/**
```

验证：

```bash
pnpm typecheck:worker
```

如果修改了 D1 migration：

```bash
pnpm d1:migrate:remote
```

部署 Worker：

```bash
pnpm deploy:worker
```

验证：

```text
https://blog.***.com/api/health
```

提交：

```bash
git add apps/worker docs package.json pnpm-lock.yaml
git commit -m "feat: update worker"
git push
```

### 14.4 修改文档后

```bash
git add docs README.md
git commit -m "docs: update documentation"
git push
```

### 14.5 修改 Secret 后

Secret 不提交 Git，只在 Cloudflare 中配置：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put SECRET_NAME
```

如果 Worker 变量在 `wrangler.toml` 中变更，则需要：

```bash
pnpm deploy:worker
git add apps/worker/wrangler.toml docs
git commit -m "chore: update worker config"
git push
```

## 15. 文档脱敏规则

提交前检查：

```text
1. 不出现真实个人邮箱
2. 不出现真实域名
3. 不出现真实 API Key
4. 不出现真实 Secret
5. 不出现真实 D1 database_id
6. 不出现管理员密码
7. 不出现可复用的私钥/Token
```

建议占位符：

```text
***.com
***@***.com
<D1_DATABASE_ID>
<SECRET_VALUE>
<WORKER_VERSION_ID>
<STRONG_PASSWORD>
```

## 16. 待处理项

当前已知待处理：

```text
1. 如果收件邮箱持续收不到带 `.json.gz` 附件的备份邮件，建议改成“只发送备份摘要和 R2 路径，不带附件”。
2. 备份恢复目前已有文档说明，但还未做完整恢复演练。
3. 后续可实现备份下载/恢复管理页面。
4. 后续可实现备份保留策略，例如保留最近 7 天每日备份、4 周每周备份、12 个月每月备份。
```
