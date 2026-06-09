# cloud-blog-lite

`cloud-blog-lite` 是一个基于 Cloudflare Serverless 的轻量级导航与站点管理系统。前端使用 Vue 3 + Vite，后端使用 Cloudflare Workers + Hono，数据存储使用 Cloudflare D1，文件资源使用 Cloudflare R2。

它适合用于：

- 个人常用网站导航页
- 团队内部工具入口管理
- 云端书签/站点收藏管理
- 轻量后台管理系统模板
- Cloudflare Pages + Workers + D1 + R2 全栈 Serverless 示例项目

## 功能概览

### 公开端

- 导航首页
- 分类侧栏
- 站点卡片展示
- 站点置顶优先展示
- 站点标签展示与标签筛选
- 热门站点排行
- 站点点击统计上报
- 站点健康状态展示
- SEO meta、robots.txt 与 sitemap.xml
- 关键词搜索
- 主题切换
- Logo / 站点基础信息展示

### 管理端

- 管理员登录
- Cloudflare Turnstile 人机验证
- 仪表盘
- 分类管理
- 站点管理
- 站点置顶与点击量查看
- Dashboard 热门站点排行
- 站点健康检查 / 死链检测
- 站点 JSON 导入 / 导出
- 标签管理与站点标签绑定
- 用户管理
- 系统设置
- 操作日志，记录站点导入导出、健康检测、标签管理等关键后台操作
- 图片上传，限制 1MB
- 文件访问接口
- D1 备份到 R2

### 后端能力

- Hono API 服务
- Cookie/JWT 登录认证
- 管理端鉴权中间件
- 管理员角色校验
- D1 数据库访问
- D1 migration 管理站点置顶、点击统计、标签系统等增量字段和表
- R2 文件上传与访问
- 统一响应格式
- 统一错误处理
- 操作日志记录与关键操作审计
- 初始化管理员接口
- Cron 定时备份
- 健康检查接口

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、TypeScript、Vue Router、Pinia、Naive UI、Axios |
| 后端 | Cloudflare Workers、Hono、TypeScript |
| 数据 | Cloudflare D1、Cloudflare R2 |
| 工程 | pnpm workspace、Wrangler、Git |

## 项目结构

```text
cloud-blog-lite
├── apps
│   ├── web                         # Vue 3 前端应用
│   │   ├── public                  # 静态资源
│   │   ├── src
│   │   │   ├── api                 # 前端 API 请求封装
│   │   │   ├── components          # 通用组件
│   │   │   ├── layouts             # 后台布局
│   │   │   ├── router              # 路由与登录拦截
│   │   │   ├── stores              # Pinia 状态
│   │   │   ├── styles              # 全局样式
│   │   │   └── views               # 页面
│   │   ├── .env.example            # 前端本地环境示例
│   │   └── vite.config.ts
│   │
│   └── worker                      # Cloudflare Worker API
│       ├── migrations              # D1 migration
│       ├── src
│       │   ├── middleware          # 中间件
│       │   ├── modules             # 业务模块
│       │   └── utils               # 工具函数
│       ├── .dev.vars.example       # Worker 本地 Secret 示例
│       ├── wrangler.toml           # 可提交的安全默认配置
│       └── wrangler.production.example.toml
│
├── docs                            # 部署、运维、恢复文档
├── packages/shared                 # 共享包预留
├── scripts/windows                 # Windows 双击脚本
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## 快速开始

### 环境要求

建议使用：

- Node.js 20+
- pnpm 9+
- Git
- Wrangler
- Cloudflare 账号，远程部署时需要

安装依赖：

```bash
pnpm install
```

### 准备本地环境文件

本地开发建议复制示例文件：

```bash
cp apps/web/.env.example apps/web/.env.development.local
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Windows PowerShell：

```powershell
Copy-Item apps/web/.env.example apps/web/.env.development.local
Copy-Item apps/worker/.dev.vars.example apps/worker/.dev.vars
```

说明：

- `apps/web/.env.development.local`：本地前端环境，默认使用 `/api` 走 Vite proxy，并使用 Turnstile 官方测试 Site Key。
- `apps/worker/.dev.vars`：本地 Worker Secret，默认包含 Turnstile 官方测试 Secret Key。
- 以上两个文件已被 `.gitignore` 忽略，不要提交。

### 初始化本地 D1

```bash
pnpm d1:migrate:local
```

如果本地 D1 migration 状态异常但缺表，可直接执行初始化 SQL：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler d1 execute cloud-blog-lite --local --file migrations/0001_initial.sql
```

### 启动本地服务

需要两个终端：

```bash
pnpm dev:worker
```

```bash
pnpm dev:web
```

访问地址：

```text
前端：http://localhost:5173
登录：http://localhost:5173/login
Worker：http://localhost:8787
健康检查：http://localhost:5173/api/health
```

### Windows 双击脚本

也可以直接双击脚本启动：

| 脚本 | 说明 |
| --- | --- |
| `scripts/windows/dev-web.cmd` | 启动本地 Web，访问 `http://localhost:5173` |
| `scripts/windows/dev-worker.cmd` | 启动本地 Worker，访问 `http://localhost:8787` |
| `scripts/windows/deploy-cloudflare.cmd` | 手动构建并部署 Worker + Pages 到 Cloudflare |

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev:web` | 启动前端开发服务 |
| `pnpm dev:worker` | 启动本地 Worker |
| `pnpm build:web` | 构建前端 |
| `pnpm typecheck:worker` | Worker 类型检查 |
| `pnpm d1:migrate:local` | 应用本地 D1 migration |
| `pnpm d1:migrate:remote` | 应用远程 D1 migration，使用生产配置 |
| `pnpm deploy:worker` | 部署 Worker，使用 `wrangler.production.toml` |

## 环境配置策略

项目区分“可提交配置”和“本地真实配置”：

| 文件 | 是否提交 | 说明 |
| --- | --- | --- |
| `apps/worker/wrangler.toml` | 是 | 安全默认配置，不包含真实域名、邮箱、D1 ID |
| `apps/worker/wrangler.production.example.toml` | 是 | 生产配置模板 |
| `apps/worker/wrangler.production.toml` | 否 | 本地真实生产配置，用于部署 |
| `apps/worker/.dev.vars.example` | 是 | 本地 Worker Secret 示例 |
| `apps/worker/.dev.vars` | 否 | 本地 Worker Secret |
| `apps/web/.env.example` | 是 | 前端本地环境示例 |
| `apps/web/.env.development.local` | 否 | 前端本地开发环境 |

新电脑 clone 后，如果需要手动部署生产 Worker，需要创建：

```bash
cp apps/worker/wrangler.production.example.toml apps/worker/wrangler.production.toml
```

然后在 `wrangler.production.toml` 里填写真实生产配置。

更多说明见：

```text
docs/deployment-and-redeploy.md  # 部署与重新部署
docs/features.md                 # 功能说明
docs/migrations.md               # 数据库 migration
docs/operations.md               # 运维说明
```

## Cloudflare 部署

### Worker Secret

生产环境需要在 Cloudflare Worker 中配置 Secret：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put JWT_SECRET
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put SITE_SECRET
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put TURNSTILE_SECRET_KEY
```

如启用备份邮件，还需要：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler secret put RESEND_API_KEY
```

不要把 Secret 写入代码、文档、截图或 Git。

### 数据库 Migration

功能迭代可能会新增 D1 字段或数据表。部署新版 Worker / Pages 前，建议先应用数据库 migration：

本地环境：

```bash
pnpm d1:migrate:local
```

生产环境：

```bash
pnpm d1:migrate:remote
```

当前线上已应用的增量结构包括：

| 对象 | 说明 |
| --- | --- |
| `sites.is_pinned` | 站点置顶字段 |
| `sites.click_count`、`sites.last_clicked_at` | 站点点击统计字段 |
| `tags`、`site_tags` | 标签和站点标签关联表 |
| `sites.health_status`、`sites.http_status`、`sites.last_checked_at`、`sites.health_error` | 站点健康检查字段 |

### 部署 Worker

确保本地存在并填写好：

```text
apps/worker/wrangler.production.toml
```

然后执行：

```bash
pnpm deploy:worker
```

### 部署 Pages

先构建：

```bash
pnpm build:web
```

再部署 Pages：

```bash
pnpm --filter @cloud-blog-lite/worker exec wrangler pages deploy ../web/dist --project-name cloud-blog-lite --commit-dirty=true
```

Windows 下也可双击：

```text
scripts/windows/deploy-cloudflare.cmd
```

## API 路由

Worker 统一挂载在 `/api` 下：

| API 前缀 | 说明 |
| --- | --- |
| `/api/public` | 公开导航接口、站点点击统计上报、sitemap.xml |
| `/api/files` | 文件访问接口 |
| `/api/auth` | 登录、退出、当前用户 |
| `/api/admin/dashboard` | 仪表盘，包含热门站点排行 |
| `/api/admin/categories` | 分类管理 |
| `/api/admin/sites` | 站点管理，包含 JSON 导入 / 导出 |
| `/api/admin/tags` | 标签管理 |
| `/api/admin/users` | 用户管理 |
| `/api/admin/upload` | 上传接口 |
| `/api/admin/settings` | 系统设置 |
| `/api/admin/operation-logs` | 操作日志 |
| `/api/admin/backups` | 备份接口 |
| `/api/setup` | 初始化管理员 |
| `/api/health` | 健康检查 |

## 数据表

初始化 migration 位于：

```text
apps/worker/migrations/0001_initial.sql
```

主要表：

| 表 | 说明 |
| --- | --- |
| `users` | 用户与管理员账号 |
| `categories` | 分类 |
| `sites` | 站点，包含置顶、点击量、健康检查等展示与统计字段 |
| `tags` | 标签 |
| `site_tags` | 站点与标签关联 |
| `settings` | 系统设置 |
| `operation_logs` | 操作日志 |

备份当前只导出核心数据表，不备份操作日志表。

## 文件与上传

- 上传接口：`/api/admin/upload`
- 文件访问：`/api/files/*`
- 上传大小限制：1MB
- 本地上传文件存储在 Wrangler/Miniflare 本地 R2 状态目录中，例如：

```text
apps/worker/.wrangler/state/v3/r2/
```

`.wrangler/` 是本地状态目录，已被 `.gitignore` 忽略。

## 本地生产数据恢复说明

如果要把生产备份 JSON 导入本地：

1. 先确保本地 D1 表结构存在。
2. 只使用 `wrangler d1 execute --local`。
3. 不要使用 `--remote`，避免影响生产 D1。
4. 生产 `password_cipher` 如果使用不同 `SITE_SECRET`，本地无法解密，系统会返回空密码但不影响站点列表展示。

更完整的部署、恢复和排错说明见：

```text
docs/deployment-and-redeploy.md
```

## Git 忽略策略

项目默认忽略：

- `node_modules/`
- `dist/`、`build/` 等构建产物
- `.wrangler/` 本地 Cloudflare 状态
- `.dev.vars`、`.env.*.local` 等本地 Secret/env 文件
- `wrangler.production.toml` 本地真实生产配置
- 日志、缓存、临时文件
- IDE/editor 本地配置

## License

当前项目未指定开源许可证。如需公开开源，建议补充 `LICENSE` 文件。
