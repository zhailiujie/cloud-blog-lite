# cloud-blog-lite

`cloud-blog-lite` 是一个面向个人/小团队使用的轻量级云端导航与站点管理系统，目标是将原有较重的博客/导航类系统拆分为更容易部署、维护成本更低的 Cloudflare Serverless 架构。

项目采用前后端分离设计：前端使用 Vue 3 构建管理后台和公开导航页，后端运行在 Cloudflare Workers 上，数据存储使用 Cloudflare D1，文件/图标等资源可接入 Cloudflare R2。整体目标是做到：部署简单、运行成本低、依赖少、适合个人云端工具站点长期维护。

## 项目用途

本项目主要用于搭建一个轻量版的个人导航/资源管理平台，适合以下场景：

- 个人常用网站导航页
- 团队内部工具入口管理
- 云端书签/站点收藏管理
- 分类化管理站点、账号备注、描述、Logo 等信息
- 简单后台管理系统示例
- Cloudflare Pages + Workers + D1 + R2 全栈 Serverless 项目模板

当前项目包含公开访问端和管理端两部分：

- 公开端：展示分类和站点导航，供用户直接访问常用链接。
- 管理端：提供登录、仪表盘、分类管理、站点管理、用户管理、系统设置、操作日志等功能。

## 核心功能

### 公开端

- 站点导航首页
- 分类展示
- 站点卡片展示
- 站点搜索/浏览能力的基础结构
- 公开 API 与管理 API 分离

### 管理端

- 管理员登录
- 登录态校验
- 仪表盘统计
- 分类管理
- 站点管理
- 用户管理
- 系统设置
- 文件上传接口
- 操作日志查看
- 角色权限控制基础能力

### 后端能力

- 基于 Hono 的 Cloudflare Workers API 服务
- D1 数据库访问
- R2 文件对象访问预留
- Cookie/JWT 登录认证
- 管理端接口鉴权中间件
- 管理员角色校验
- 统一响应格式
- 统一错误处理中间件
- 操作日志记录工具
- 初始化安装接口
- 健康检查接口

## 技术栈

### 前端

| 技术 | 用途 |
| --- | --- |
| Vue 3 | 前端应用框架 |
| Vite | 前端构建工具 |
| TypeScript | 类型约束与开发体验 |
| Vue Router | 路由管理 |
| Pinia | 状态管理 |
| Naive UI | 后台 UI 组件库 |
| Axios | HTTP 请求封装 |

### 后端

| 技术 | 用途 |
| --- | --- |
| Cloudflare Workers | Serverless API 运行环境 |
| Hono | 轻量级 Web 框架 |
| TypeScript | Worker 端类型约束 |
| Cloudflare D1 | SQLite 兼容数据库 |
| Cloudflare R2 | 对象存储，用于文件/图片资源 |
| Wrangler | Cloudflare 本地开发、迁移和部署工具 |

### 工程化

| 技术 | 用途 |
| --- | --- |
| pnpm workspace | Monorepo 包管理 |
| TypeScript | 全栈类型支持 |
| Git | 版本管理 |
| `.gitignore` | 排除依赖、日志、构建产物、本地状态与密钥文件 |

## 整体架构

```text
cloud-blog-lite
├── apps
│   ├── web              # Vue 3 前端应用
│   │   ├── src
│   │   │   ├── api      # 前端 API 请求封装
│   │   │   ├── components
│   │   │   ├── layouts
│   │   │   ├── router
│   │   │   ├── stores
│   │   │   ├── styles
│   │   │   └── views
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── worker           # Cloudflare Workers 后端 API
│       ├── migrations   # D1 数据库迁移 SQL
│       ├── src
│       │   ├── db       # D1 数据库访问封装
│       │   ├── middleware
│       │   ├── modules  # 业务模块路由
│       │   └── utils
│       ├── wrangler.toml
│       └── package.json
│
├── packages
│   └── shared           # 前后端共享类型/工具预留包
│
├── docs                 # 项目设计、重构、迁移文档
├── package.json         # 根项目脚本
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## 架构说明

### 1. 前端 Web 应用

前端位于 `apps/web`，负责公开导航页和管理后台页面展示。

主要模块：

- `src/views/public`：公开导航页面
- `src/views/auth`：登录页面
- `src/views/admin`：后台管理页面
- `src/layouts`：后台布局
- `src/router`：路由配置和登录拦截
- `src/stores`：Pinia 状态管理，例如用户登录态、主题配置
- `src/api`：接口请求封装
- `src/components`：通用组件
- `src/styles`：全局样式

前端路由主要包括：

| 路径 | 说明 |
| --- | --- |
| `/` | 公开导航页 |
| `/login` | 管理员登录页 |
| `/admin` | 后台首页/仪表盘 |
| `/admin/categories` | 分类管理 |
| `/admin/sites` | 站点管理 |
| `/admin/users` | 用户管理 |
| `/admin/settings` | 系统设置 |
| `/admin/logs` | 操作日志 |

后台路由通过 `router.beforeEach` 进行登录态检查，未登录时自动跳转到 `/login`。

### 2. Worker API 服务

后端位于 `apps/worker`，入口文件为：

```text
apps/worker/src/index.ts
```

后端使用 Hono 创建 API 服务，并统一挂载在 `/api` 路径下。

主要接口分组：

| API 前缀 | 说明 |
| --- | --- |
| `/api/public` | 公开端接口 |
| `/api/files` | 文件访问接口 |
| `/api/auth` | 登录、退出、当前用户等认证接口 |
| `/api/admin/dashboard` | 仪表盘接口 |
| `/api/admin/categories` | 分类管理接口 |
| `/api/admin/sites` | 站点管理接口 |
| `/api/admin/users` | 用户管理接口 |
| `/api/admin/upload` | 上传接口 |
| `/api/admin/settings` | 系统设置接口 |
| `/api/admin/operation-logs` | 操作日志接口 |
| `/api/setup` | 初始化安装接口 |
| `/api/debug` | 调试接口 |
| `/api/health` | 健康检查接口 |

其中 `/api/admin/*` 接口会先经过认证中间件，用户管理接口还会额外校验管理员角色。

### 3. 数据存储

项目使用 Cloudflare D1 作为主要数据库。初始化迁移文件位于：

```text
apps/worker/migrations/0001_initial.sql
```

当前包含的数据表：

| 表名 | 说明 |
| --- | --- |
| `users` | 用户表，保存管理员账号、密码哈希、角色、状态等 |
| `categories` | 分类表，支持父级分类、排序、显示隐藏 |
| `sites` | 站点表，保存站点名称、链接、描述、Logo、所属分类等 |
| `settings` | 系统设置表 |
| `operation_logs` | 操作日志表 |

### 4. 文件存储

项目预留 Cloudflare R2 作为对象存储，适合存储：

- 站点 Logo
- 上传图片
- 附件资源
- 未来扩展的静态资源

R2 绑定配置位于：

```text
apps/worker/wrangler.toml
```

当前配置示例：

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "cloud-blog-lite-files"
```

### 5. 鉴权与权限

后端提供基础认证和权限机制：

- 登录后通过 Cookie/JWT 保存登录态
- `/api/admin/*` 接口需要登录
- `/api/admin/users/*` 需要管理员角色
- 认证逻辑位于 `apps/worker/src/middleware/auth.ts`
- 角色校验位于 `apps/worker/src/middleware/role.ts`

## 数据流说明

```text
浏览器
  │
  │ 访问页面
  ▼
Vue 3 前端应用
  │
  │ Axios 请求 /api/*
  ▼
Cloudflare Worker / Hono API
  │
  ├── 认证中间件
  ├── 业务模块路由
  ├── D1 数据库
  └── R2 对象存储
```

部署到 Cloudflare 后，推荐形态如下：

```text
用户浏览器
  │
  ▼
Cloudflare Pages
  │
  ├── 静态前端资源
  │
  └── /api/* 转发或绑定到 Worker
          │
          ├── D1
          └── R2
```

## 本地开发

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

### 启动前端

```bash
pnpm dev:web
```

默认由 Vite 启动前端开发服务。

### 启动 Worker

```bash
pnpm dev:worker
```

Worker 默认使用 Wrangler 本地模式运行，端口配置在 `apps/worker/package.json` 中：

```bash
wrangler dev --local --port 8787
```

### 本地应用 D1 迁移

```bash
pnpm d1:migrate:local
```

### 远程应用 D1 迁移

```bash
pnpm d1:migrate:remote
```

## 构建与检查

### 构建前端

```bash
pnpm build:web
```

### 预览前端构建结果

```bash
pnpm preview:web
```

### Worker 类型检查

```bash
pnpm typecheck:worker
```

### 部署 Worker

```bash
pnpm deploy:worker
```

## Cloudflare 配置说明

Worker 配置文件位于：

```text
apps/worker/wrangler.toml
```

当前包含：

- Worker 名称
- Worker 入口
- compatibility date
- 环境变量
- D1 数据库绑定
- R2 Bucket 绑定

示例：

```toml
name = "cloud-blog-lite-api"
main = "src/index.ts"
compatibility_date = "2024-06-01"

[vars]
APP_NAME = "cloud-blog-lite-worker"
COOKIE_NAME = "cloud_blog_token"

[[d1_databases]]
binding = "DB"
database_name = "cloud-blog-lite"
database_id = "local-development-placeholder"

[[r2_buckets]]
binding = "R2"
bucket_name = "cloud-blog-lite-files"
```

正式部署前需要将 `database_id` 替换为 Cloudflare D1 创建后返回的真实 ID。

## Git 忽略策略

项目已添加 `.gitignore`，默认不会提交以下内容：

- `node_modules/`
- 构建产物，例如 `dist/`、`build/`
- Cloudflare 本地状态，例如 `.wrangler/`
- 环境变量文件，例如 `.env`、`.env.*`
- 日志文件，例如 `*.log`、`logs/`
- 缓存文件、临时文件、系统文件、IDE 配置等

这样可以保证仓库只包含源码、文档、配置、迁移文件和 lockfile，不上传依赖、日志、密钥、本地状态等无关或敏感内容。

## 当前项目状态

当前已具备轻量导航系统的基础结构：

- Monorepo 工程结构
- Vue 3 前端应用
- Hono Worker 后端服务
- D1 数据库表结构
- 公开端与管理端路由
- 管理后台基础页面
- 鉴权、角色、中间件结构
- 上传、设置、日志等模块接口结构
- Cloudflare 部署配置雏形

后续可以继续完善：

- 前端页面交互细节
- API 错误提示体验
- 初始化安装流程
- R2 上传和文件访问策略
- Cloudflare Pages 与 Worker 的正式部署配置
- 更多权限角色和审计能力

## License

当前项目未指定开源许可证。如需公开开源，建议补充 `LICENSE` 文件。
