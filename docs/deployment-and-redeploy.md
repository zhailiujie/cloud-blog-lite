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

将真实 `database_id` 写入本地生产配置：

```text
apps/worker/wrangler.production.toml
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

`wrangler.toml` 和 `wrangler.production.toml` 中都需要配置 R2 绑定；其中真实生产部署以 `wrangler.production.toml` 为准：

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
TURNSTILE_SECRET_KEY
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

### 5.3 TURNSTILE_SECRET_KEY

用途：登录页 Cloudflare Turnstile 人机验证服务端校验。

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put TURNSTILE_SECRET_KEY
```

注意：Turnstile `site_key` 是公开前端配置，`Secret Key` 只能放在 Worker Secret 中，不能写入代码、文档或 Git。

### 5.4 RESEND_API_KEY

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

当前项目将 Worker 配置拆成两类：

```text
apps/worker/wrangler.toml                    可提交到 Git 的安全默认配置
apps/worker/wrangler.production.example.toml 生产配置示例，可提交
apps/worker/wrangler.production.toml         本地真实生产配置，不提交
apps/worker/.dev.vars.example                本地 Secret 示例，可提交
apps/worker/.dev.vars                        本地 Secret， 不提交
```

### 6.1 可提交的默认配置

`apps/worker/wrangler.toml` 不应包含真实域名、邮箱、D1 database_id 或 Secret。它只保留安全默认值和占位符：

```toml
name = "cloud-blog-lite-api"
main = "src/index.ts"
compatibility_date = "2024-06-01"

[vars]
APP_NAME = "cloud-blog-lite-worker"
COOKIE_NAME = "cloud_blog_token"
BACKUP_EMAIL_TO = ""
BACKUP_EMAIL_FROM = ""

[triggers]
crons = ["0 17 * * *"]

[[d1_databases]]
binding = "DB"
database_name = "cloud-blog-lite"
database_id = "local-development-placeholder"
```

### 6.2 本地生产部署配置

首次部署或换机器部署前，复制示例文件：

```bash
cp apps/worker/wrangler.production.example.toml apps/worker/wrangler.production.toml
```

Windows PowerShell：

```powershell
Copy-Item apps/worker/wrangler.production.example.toml apps/worker/wrangler.production.toml
```

然后只在 `apps/worker/wrangler.production.toml` 中填写真实生产值：

```toml
routes = [
  { pattern = "blog.<your-domain>.com/api/*", zone_name = "<your-domain>.com" }
]

BACKUP_EMAIL_TO = "<your-email>"
BACKUP_EMAIL_FROM = "cloud-blog-lite <backup@<your-domain>.com>"
database_id = "<D1_DATABASE_ID>"
```

`apps/worker/wrangler.production.toml` 已加入 `.gitignore`，只用于本地部署，不提交 Git。

### 6.3 本地开发 Secret

本地 Worker 开发可复制：

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

并填写本地开发用 Secret。`.dev.vars` 已加入 `.gitignore`，不要提交。

### 6.4 新电脑 clone 后需要创建的本地文件

以下文件包含本地状态、真实生产配置或 Secret，不会提交到 Git。因此在新电脑重新 clone 项目后，需要按需手动创建。

| 文件/目录 | 是否必须 | 创建方式 | 用途 | 是否提交 |
| --- | --- | --- | --- | --- |
| `node_modules/` | 必须 | `pnpm install` | 安装依赖，用于构建、类型检查、部署 | 否 |
| `apps/worker/wrangler.production.toml` | 生产部署必须 | 从 `apps/worker/wrangler.production.example.toml` 复制 | 保存真实生产 Worker Route、D1 ID、邮件变量等 | 否 |
| `apps/worker/.dev.vars` | 本地跑 Worker 时需要 | 从 `apps/worker/.dev.vars.example` 复制 | 保存本地 Worker Secret，例如 JWT、加密密钥、Turnstile Secret | 否 |
| `apps/web/.env.development.local` | 本地前端请求本地 Worker 时需要 | 从 `apps/web/.env.example` 复制 | 配置本地前端 API 代理和本地 Turnstile 测试 Site Key | 否 |
| `.wrangler/` | 不需要手动创建 | Wrangler 自动生成 | Wrangler 本地状态 | 否 |
| `apps/web/dist/` | 不需要手动创建 | `pnpm build:web` 自动生成 | 前端构建产物 | 否 |

新电脑初始化推荐步骤：

```bash
pnpm install
cp apps/worker/wrangler.production.example.toml apps/worker/wrangler.production.toml
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
cp apps/web/.env.example apps/web/.env.development.local
```

Windows PowerShell：

```powershell
pnpm install
Copy-Item apps/worker/wrangler.production.example.toml apps/worker/wrangler.production.toml
Copy-Item apps/worker/.dev.vars.example apps/worker/.dev.vars
Copy-Item apps/web/.env.example apps/web/.env.development.local
```

然后根据实际环境填写：

```text
1. apps/worker/wrangler.production.toml：填写真实生产域名、Zone、D1 database_id、备份邮箱等。
2. apps/worker/.dev.vars：填写本地开发 Secret。
3. apps/web/.env.development.local：本地前端通过 Vite proxy 请求本地 Worker，保留 `VITE_API_BASE=/api`；本地 Turnstile 使用官方测试 `VITE_TURNSTILE_SITE_KEY`；生产构建通常不需要设置。
```

注意：

```text
1. 这些本地文件都不应提交 Git。
2. 如果只是修改代码并由 Cloudflare Pages 自动构建，通常只需要 pnpm install。
3. 如果需要从新电脑手动部署 Worker，必须先创建并填写 apps/worker/wrangler.production.toml。
4. Cloudflare Worker Secret 存在 Cloudflare 远端，不在 Git 中；新电脑只需要 wrangler login 后即可查看/部署。如果换了 Cloudflare 账号或 Worker，需要重新 wrangler secret put。
```

## 7. 执行远程 D1 Migration

远程迁移使用本地生产配置文件：

```bash
pnpm d1:migrate:remote
```

该命令会读取：

```text
apps/worker/wrangler.production.toml
```

预期结果：

```text
0001_initial.sql 执行成功
远程 D1 创建 users/categories/sites/tags/site_tags/settings/operation_logs 等表，并补齐 sites 的置顶、点击统计与健康检查字段
```

补充说明：公开端 SEO 相关的 `robots.txt` 随 Pages 静态资源部署，`/api/public/sitemap.xml` 由 Worker 动态返回；这两项不需要额外 D1 字段。

## 8. 部署 Worker

部署 Worker 使用本地生产配置文件：

```bash
pnpm deploy:worker
```

该命令最终执行：

```bash
wrangler deploy --config wrangler.production.toml
```

如果遇到 pnpm 9 内置 `deploy` 命令冲突，根项目脚本应使用：

```json
{
  "deploy:worker": "pnpm --filter @cloud-blog-lite/worker run deploy:production"
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
Environment variable: VITE_API_BASE=/api 或不设置，生产默认使用 /api
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
apps/worker/wrangler.production.example.toml
apps/worker/migrations/**
```

验证：

```bash
pnpm typecheck:worker
```

如果修改了 D1 migration，或包含依赖新字段/新表的功能（如站点置顶、点击统计、标签筛选、热门站点排行、站点健康检查、站点导入导出）：

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

如果 Worker 公共变量模板在 `wrangler.toml` 或 `wrangler.production.example.toml` 中变更，则需要：

```bash
pnpm deploy:worker
git add apps/worker/wrangler.toml apps/worker/wrangler.production.example.toml docs
git commit -m "chore: update worker config"
git push
```

如果只修改了本地真实生产值，应只改 `apps/worker/wrangler.production.toml`，不要提交。

## 15. 部署排错与注意事项

以下问题是实际部署中容易遇到的坑，文档中只记录通用原因和处理方式，不记录真实 Secret、邮箱、域名、账号信息。

### 15.1 本地依赖缺失导致检查/构建失败

如果执行：

```bash
pnpm typecheck:worker
pnpm build:web
```

出现类似：

```text
'tsc' 不是内部或外部命令
'vue-tsc' 不是内部或外部命令
Local package.json exists, but node_modules missing
```

说明当前工作区没有安装依赖，需要先执行：

```bash
pnpm install
```

注意：如果本机 pnpm 版本低于项目锁文件版本，可能出现 lockfile 兼容警告，并导致 `pnpm-lock.yaml` 被旧版本 pnpm 重写。部署前应确认锁文件是否发生无关变更；如果只是本机旧 pnpm 造成的锁文件格式降级，不要提交该无关变更。

建议使用与 `package.json` 中 `packageManager` 匹配的 pnpm 版本。

### 15.2 Wrangler 未登录会阻止部署

如果执行 Wrangler 命令时出现：

```text
You are not authenticated. Please run `wrangler login`.
```

需要先登录：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler login
```

验证：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler whoami
```

文档和提交记录中不要记录真实账号邮箱，只记录“已登录并具备权限”。

### 15.3 新增 Secret 后必须先配置再部署/验证

如果代码新增了 Worker Secret，例如验证码、第三方 API、加密密钥等，必须先在 Cloudflare Worker 中配置：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put SECRET_NAME
```

检查 Secret 是否存在：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret list
```

注意：

```text
1. 不要把 Secret 写入 wrangler.toml。
2. 不要通过 echo、命令参数、脚本硬编码等方式传入 Secret。
3. 不要把 Secret 发到聊天记录、截图、文档或 Git。
4. 如果 Secret 曾经暴露，应到对应平台轮换后重新配置。
```

如果缺少必需 Secret，Worker 可能可以部署成功，但运行到相关接口时会返回配置错误。

### 15.4 Turnstile/验证码类功能需要同时配置前后端

如果接入 Cloudflare Turnstile 或类似验证码，需要确认：

```text
1. 前端使用的是公开 site key。
2. 后端使用 Secret，并通过 Wrangler Secret 管理。
3. Cloudflare Turnstile 后台已允许当前访问 hostname。
4. 测试环境、预览环境、正式域名需要分别加入允许 hostname。
```

如果页面显示“无法连接到网站”或验证码加载失败，优先检查：

```text
1. 当前 hostname 是否在 Turnstile 允许列表中。
2. 浏览器/代理/插件是否拦截 challenges.cloudflare.com。
3. 前端部署后是否实际访问到了最新构建产物。
```

### 15.5 Worker Route 的 zone_name 不能使用占位值

`apps/worker/wrangler.production.example.toml` 中的 Worker Route 示例会使用占位符：

```toml
routes = [
  { pattern = "blog.<your-domain>/api/*", zone_name = "<your-zone>" }
]
```

本地部署前必须把 `zone_name` 改成 Cloudflare 中真实存在的 Zone 名称。否则 `pnpm deploy:worker` 可能报错：

```text
Could not find zone for `<placeholder>`.
Make sure the domain is set up to be proxied by Cloudflare.
```

处理方式：

```text
1. 到 Cloudflare Dashboard 确认当前站点所属 Zone。
2. 将 `apps/worker/wrangler.production.toml` 中的 route pattern 和 zone_name 改成本地部署所需真实值。
3. `apps/worker/wrangler.production.toml` 已加入 `.gitignore`，不要提交真实生产值。
```

### 15.6 Worker 上传成功但路由绑定失败时要看完整日志

`wrangler deploy` 可能先显示：

```text
Uploaded <worker-name>
```

随后又因为路由、权限或 Zone 配置失败而退出。此时不能只看 “Uploaded”，应确认最终是否出现：

```text
Deployed <worker-name> triggers
Current Version ID: <WORKER_VERSION_ID>
```

只有出现最终部署成功信息并且 `/api/health` 验证通过，才算部署完成。

### 15.7 Pages 部署时注意执行目录和 dist 路径

如果使用：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler pages deploy apps/web/dist --project-name <pages-project>
```

`pnpm --filter ... exec` 可能会以 `apps/worker` 作为执行目录，导致 Wrangler 实际查找：

```text
apps/worker/apps/web/dist
```

从而报错：

```text
ENOENT: no such file or directory, scandir '<wrong-dist-path>'
```

推荐使用相对于 `apps/worker` 的路径：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler pages deploy ../web/dist --project-name <pages-project> --commit-dirty=true
```

或者使用文档中的 `--dir apps/worker` 写法：

```bash
pnpm --dir apps/worker exec wrangler pages deploy ../web/dist --project-name <pages-project> --branch main --commit-dirty=true
```

### 15.8 根目录可能找不到 wrangler

本项目的 `wrangler` 安装在 Worker 子包中。如果在根目录执行：

```bash
pnpm exec wrangler ...
```

可能报错：

```text
'wrangler' 不是内部或外部命令，也不是可运行的程序
Command "wrangler" not found
```

应改用：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler ...
```

或：

```bash
pnpm --dir apps/worker exec wrangler ...
```

### 15.9 Pages 提示未提交变更不是失败

如果部署 Pages 时出现：

```text
Warning: Your working directory is a git repo and has uncommitted changes
To silence this warning, pass in --commit-dirty=true
```

这是提醒当前工作区有未提交变更，不一定是错误。临时手动部署可加：

```bash
--commit-dirty=true
```

但正式发布前仍建议检查：

```bash
git status --short
git diff --stat
```

确认没有无关文件、敏感信息或本地状态被带入提交。

### 15.10 Pages wrangler.toml 提示可忽略或单独配置

部署 Pages 时可能看到：

```text
Pages now has wrangler.toml support
missing the pages_build_output_dir field
Ignoring configuration file for now
```

这是 Wrangler 检测到某个 `wrangler.toml`，但该文件是 Worker 配置，不是 Pages 配置。只要后续 Pages 上传成功，这个警告可以忽略。

如果未来希望统一用 Pages 的 `wrangler.toml` 管理，需要单独评估并配置 `pages_build_output_dir`，避免影响现有 Worker 配置。

### 15.11 部署完成后必须做线上验证

部署命令成功不代表业务完全可用。至少验证：

```text
1. /api/health 返回 status: UP。
2. 前端页面访问的是最新部署版本。
3. 登录流程可用。
4. 新增的 Secret 相关接口运行正常。
5. 上传、备份等被修改过的功能符合预期。
```

Worker 健康检查示例：

```text
https://blog.***.com/api/health
```

## 16. 文档脱敏规则

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

## 17. 待处理项

当前已知待处理：

```text
1. 如果收件邮箱持续收不到带 `.json.gz` 附件的备份邮件，建议改成“只发送备份摘要和 R2 路径，不带附件”。
2. 备份恢复文档已编写，核心数据恢复演练已完成。
3. 后续可实现备份下载/恢复管理页面。
4. 后续可实现备份保留策略，例如保留最近 7 天每日备份、4 周每周备份、12 个月每月备份。
```
