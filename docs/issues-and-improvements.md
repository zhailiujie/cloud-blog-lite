# 问题清单与优化计划

本文档汇总了对 `cloud-blog-lite` 前后端代码的全面审查结果，按严重程度和类别分组，供后续逐项修复参考。

每项修复完成后在对应条目前打 ✅。

---

## 目录

- [后端 · 严重安全（Critical）](#后端--严重安全critical)
- [后端 · 高危安全（High）](#后端--高危安全high)
- [后端 · 中危安全（Medium）](#后端--中危安全medium)
- [后端 · 低危安全（Low）](#后端--低危安全low)
- [后端 · Bug](#后端--bug)
- [后端 · 性能](#后端--性能)
- [后端 · 代码质量](#后端--代码质量)
- [前端 · 安全](#前端--安全)
- [前端 · Bug](#前端--bug)
- [前端 · 体验缺陷](#前端--体验缺陷)
- [前端 · 代码质量](#前端--代码质量)

---

## 后端 · 严重安全（Critical）

### ✅ C-01 备份文件可被任何人公开下载

**已修复**：`2026-05-27`  
**修复方式**：在 `fileRoutes.get('/*')` 中增加前缀检查，`backups/` 开头的 key 一律返回 404，对外不暴露备份文件存在与否。

**文件**：`apps/worker/src/modules/upload/routes.ts`、`modules/backup/service.ts`、`src/index.ts`

**描述**：
`/api/files/*` 挂载点没有任何认证中间件保护。R2 备份文件与用户上传文件存放在同一个 Bucket，备份路径格式完全可预测：

```
backups/d1/daily/YYYY-MM-DD/cloud-blog-lite-d1-YYYY-MM-DDTHH-MM-SSZ.json.gz
```

攻击者无需登录，只需猜测日期，即可下载包含所有用户密码哈希、站点加密密码、系统设置在内的完整数据库快照。

**修复方向**：
- 方案一：在 `fileRoutes` 中对 `backups/` 前缀的请求拒绝访问（最简单）
- 方案二：将备份文件路径设为不可猜测的随机前缀
- 方案三：将备份文件单独存放在另一个私有 Bucket，不通过 `/api/files/` 对外暴露

---

### ✅ C-02 `/api/debug/bindings` 端点完全无保护

**已修复**：`2026-05-27`  
**修复方式**：删除 `apps/worker/src/modules/debug/` 目录，并从 `index.ts` 移除对应的 import 和路由注册。

**文件**：`apps/worker/src/modules/debug/routes.ts`、`src/index.ts`

**描述**：
`app.route("/debug", debugRoutes)` 没有任何认证中间件，任何人均可访问，获取 `APP_NAME`、D1 是否绑定及可用、R2 是否绑定等内部配置信息，为进一步攻击提供情报。

**修复方向**：
- 生产环境建议直接删除该路由（或通过环境变量开关控制）
- 至少需要加 `authMiddleware` + `requireRole(['admin'])`

---

## 后端 · 高危安全（High）

### ✅ H-01 硬编码兜底 Secret，生产漏配时无声使用弱密钥

**已修复**：`2026-05-27`  
**修复方式**：`JWT_SECRET` 和 `SITE_SECRET` 缺失时直接抛出明确错误，不再使用任何硬编码开发兜底密钥；`SITE_SECRET` 也保持独立，不回落到 `JWT_SECRET`。

**文件**：`apps/worker/src/utils/jwt.ts`、`apps/worker/src/utils/secret.ts`

**描述**：
```typescript
// jwt.ts
const secret = env.JWT_SECRET || 'local-development-jwt-secret-change-before-production'

// secret.ts
const secret = env.SITE_SECRET || env.JWT_SECRET || 'local-development-site-secret-change-before-production'
```
若生产环境未正确配置这两个 Secret，系统会无声地使用硬编码弱密钥，不产生任何告警，攻击者可利用已知密钥伪造 JWT token 或解密站点密码。

**修复方向**：
- 若 `JWT_SECRET` / `SITE_SECRET` 未配置，应直接抛出明确错误（如 `throw new Error('JWT_SECRET is not configured')`），阻止 Worker 正常响应，而非静默降级

---

### ✅ H-02 Auth Cookie 缺少 `Secure` 标志

**已修复**：`2026-05-27`  
**修复方式**：在 `utils/cookie.ts` 的 `createCookie` 和 `clearCookie` 函数末尾追加 `; Secure`。

**文件**：`apps/worker/src/utils/cookie.ts`

**描述**：
```typescript
// 当前
return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax`
// 缺少 Secure
```
缺少 `Secure` 标志意味着 Cookie 可通过 HTTP 明文连接传输，中间人攻击可以窃取认证 token。

**修复方向**：
- 在 cookie 字符串中追加 `; Secure`

---

### ✅ H-03 `login_error_count` 只记录不检查，账号锁定形同虚设

**已修复**：`2026-05-27`  
**修复方式**：
1. `UserRow` 接口新增 `login_error_count` 字段，SELECT 查询同步补充该字段
2. 密码校验前检查 `login_error_count >= 10`，超限时返回 HTTP 429 并提示联系管理员
3. `verifyTurnstile` 中 `TURNSTILE_SECRET_KEY` 未配置时直接抛出明确配置错误，不再跳过验证，确保所有环境都使用已配置的 Turnstile secret key 完成校验

**文件**：`apps/worker/src/modules/auth/routes.ts`

**描述**：
密码错误时递增 `login_error_count`，但代码中没有任何地方读取该字段。Turnstile 是当前唯一的暴力破解防护手段，若 `TURNSTILE_SECRET_KEY` 未配置则直接抛出 500 异常（本身也是个 bug）。

**修复方向**：
- 登录时读取 `login_error_count`，超过阈值（如 10 次）后锁定账号或引入指数退避
- `TURNSTILE_SECRET_KEY` 未配置时应返回合理的配置错误而非 500

---

### ✅ H-04 `verifyPassword` 解析了 `iterations` 却从不使用

**已修复**：`2026-05-27`  
**修复方式**：`derivePassword` 新增 `iterations` 参数（默认值为常量），`verifyPassword` 将解析出的迭代次数传入，确保未来升级常量后旧密码仍可正常验证。

**文件**：`apps/worker/src/utils/crypto.ts`

**描述**：
```typescript
const [type, iterationsText, saltText, expectedHash] = passwordHash.split('$')
// iterationsText 提取后从未使用！
const hash = await derivePassword(password, salt) // 始终使用编译时常量 100_000
```
`iterationsText` 被解构后完全忽略，`derivePassword` 始终使用硬编码的 `PBKDF2_ITERATIONS`。这导致：一旦未来升级哈希迭代次数常量，所有现有密码将立即无法验证，全体用户无法登录。存储迭代次数的设计意图被彻底破坏。

**修复方向**：
- 将解析出的 `iterationsText` 传入 `derivePassword`，使其使用哈希存储时的迭代次数，而非当前常量

---

### ✅ H-05 密码比较使用非常量时间字符串比较，存在时序攻击风险

**已修复**：`2026-05-27`  
**修复方式**：新增 `timingSafeEqual(a, b)` 函数，利用 `crypto.subtle` HMAC sign+verify 实现常量时间字节比较，替代原有的 `===` 字符串比较。

**文件**：`apps/worker/src/utils/crypto.ts`

**描述**：
```typescript
return hash === expectedHash  // JavaScript === 对字符串非常量时间
```
理论上允许通过响应时间差异（timing side-channel）枚举密码前缀。

**修复方向**：
- 将 Base64 字符串转为 `Uint8Array`，使用 `crypto.subtle.timingSafeEqual()` 进行常量时间比较

---

### ✅ H-06 `SITE_SECRET` 未配置时回落到 `JWT_SECRET`，轮换密钥会导致数据永久损失

**已修复**：`2026-05-27`  
**修复方式**：移除 `utils/secret.ts` 中的 `|| env.JWT_SECRET` 回落，`SITE_SECRET` 现在严格独立，轮换 JWT 密钥不再影响站点密码加密。

**文件**：`apps/worker/src/utils/secret.ts`

**描述**：
```typescript
const secret = env.SITE_SECRET || env.JWT_SECRET || fallback
```
若仅配置了 `JWT_SECRET`（未配置 `SITE_SECRET`），轮换 `JWT_SECRET`（目的是使所有会话失效）将同时导致所有通过 `encryptSecret` 加密的站点密码无法解密，造成数据永久损失。

**修复方向**：
- `SITE_SECRET` 必须独立配置，不得回落到 `JWT_SECRET`
- 若 `SITE_SECRET` 未设置，直接抛出错误

---

## 后端 · 中危安全（Medium）

### ✅ M-01 SVG 文件上传后以 `image/svg+xml` Content-Type 提供服务，可导致 XSS

**已修复**：`2026-05-27`  
**修复方式**：从 `ALLOWED_TYPES` 中移除 `image/svg+xml`，同时顺带修复 B-01（补齐 `image/x-icon → ico` 的扩展名映射）。

**文件**：`apps/worker/src/modules/upload/routes.ts`

**描述**：
`ALLOWED_TYPES` 中包含 `image/svg+xml`，浏览器以此类型加载 SVG 时会执行其中内嵌的 JavaScript，可导致存储型 XSS。

**修复方向**：
- 从 `ALLOWED_TYPES` 中移除 `image/svg+xml`
- 或在提供 SVG 文件时强制返回 `Content-Type: text/plain` 或 `Content-Disposition: attachment`

---

### ✅ M-02 `PUT /admin/users/:id` 不传 `status` 时静默重新启用被禁用账号

**已修复**：`2026-05-27`  
**修复方式**：`nextStatus` 逻辑改为 `body.status === 0 ? 0 : body.status === 1 ? 1 : oldUser.status`，仅在请求体明确携带 `status` 字段时才更新，否则保留原值。

**文件**：`apps/worker/src/modules/user/routes.ts`

**描述**：
```typescript
const nextStatus = body.status === 0 ? 0 : 1
```
若请求体中未包含 `status` 字段（仅更新昵称等），`body.status` 为 `undefined`，导致 `nextStatus = 1`，被禁用的账号会被静默重新启用。

**修复方向**：
- 改为仅在请求体中明确包含 `status` 字段时才更新该字段
- 或改为 `body.status === 1 ? 1 : body.status === 0 ? 0 : existingStatus`

---

### ✅ M-03 Setup 初始化和管理员数量保护均存在 TOCTOU 竞态

**已修复**：`2026-05-27`  
**修复方式**：Setup 的 INSERT 改为 `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1)`，将检查与插入合并为原子 SQL 操作，通过 `result.meta.changes === 0` 判断是否已初始化，彻底消除 TOCTOU。

**文件**：`apps/worker/src/modules/setup/routes.ts`、`modules/user/routes.ts`

**描述**：
- **Setup**：检查用户数为 0 → 并发请求均通过检查 → 各自创建管理员账号 → 产生多个初始管理员
- **管理员降级保护**：`countActiveAdmins` → UPDATE，两个并发请求均看到 count=2，均通过检查后都降级，最终产生 0 个活跃管理员

**修复方向**：
- D1 使用 `INSERT OR IGNORE` + 唯一约束，或利用 D1 的事务 API
- 管理员降级改为在 SQL 中加 `WHERE (SELECT COUNT(*) FROM users WHERE role='admin' AND status=1) > 1` 条件

---

### ✅ M-04 日志清理接口无角色限制，任意登录用户可删除审计记录

**已修复**：`2026-05-27`  
**修复方式**：在 `index.ts` 中于 `logRoutes` 注册前加 `app.use("/admin/operation-logs/cleanup*", requireRole(["admin"]))`，仅 admin 角色可执行清理操作。

**文件**：`apps/worker/src/modules/log/routes.ts`

**描述**：
`logRoutes` 挂载在 `/admin/operation-logs` 下，仅受通用 `authMiddleware` 保护。`editor`、`viewer` 角色均可调用 `DELETE /cleanup` 删除操作日志，破坏审计完整性。

**修复方向**：
- 在 `index.ts` 中为日志清理路由单独加 `requireRole(['admin'])` 中间件

---

### ✅ M-05 用户名缺少字符白名单校验

**已修复**：`2026-05-27`  
**修复方式**：在 `user/routes.ts` 和 `setup/routes.ts` 中统一添加 `USERNAME_REGEX = /^[a-zA-Z0-9_\-.]+$/` 校验，仅允许字母、数字、下划线、连字符和点。

**文件**：`apps/worker/src/modules/user/routes.ts`、`modules/setup/routes.ts`

**描述**：
用户名仅验证长度（3-32），未限制字符集，允许空格、控制字符、特殊符号等，可能导致显示异常。

**修复方向**：
- 增加正则白名单，如 `/^[a-zA-Z0-9_\-\.]+$/`

---

## 后端 · 低危安全（Low）

### ✅ L-01 登录接口存在用户名枚举时序差异

**已修复**：`2026-05-27`  
**修复方式**：用户名不存在时仍执行一次固定 dummy hash 的 `verifyPassword`，减少不存在用户与密码错误用户之间的 PBKDF2 耗时差异。

**文件**：`apps/worker/src/modules/auth/routes.ts`

**描述**：
用户名不存在时直接返回（不执行 PBKDF2），密码错误时需完整执行哈希运算，两者响应时间差异明显，可通过时序分析枚举有效用户名。

**修复方向**：
- 用户名不存在时仍执行一次虚拟 `verifyPassword`，消除时序差异

---

### ✅ L-02 Auth Cookie 建议从 `SameSite=Lax` 升级为 `SameSite=Strict`

**已修复**：`2026-05-27`  
**修复方式**：`createCookie` 和 `clearCookie` 均改为输出 `SameSite=Strict`，并保留 `HttpOnly`、`Secure`。

**文件**：`apps/worker/src/utils/cookie.ts`

**描述**：
`Lax` 在用户通过外部链接跳转时仍会携带 Cookie，`Strict` 可提供更强的 CSRF 防护。

**修复方向**：
- 将 `SameSite=Lax` 改为 `SameSite=Strict`（需确认不影响正常跳转流程）

---

### ✅ L-03 文件 key 提取依赖硬编码路径字符串，脆弱易错

**已修复**：`2026-05-27`  
**修复方式**：`fileRoutes.get('/*')` 改为通过 `c.req.param('*')` 读取通配符文件 key，不再依赖 `/api/files/` 挂载路径字符串替换。

**文件**：`apps/worker/src/modules/upload/routes.ts`

**描述**：
```typescript
const key = c.req.path.replace("/api/files/", "")
```
若路由挂载点变化，该替换静默失效，key 变成带 `/` 前缀的错误值。

**修复方向**：
- 改为 `c.req.param('*')` 或 Hono 的通配符路由参数

---

## 后端 · Bug

### ✅ B-01 `image/x-icon` 无 MIME 到扩展名映射，上传后存为 `.bin`

**已修复**：`2026-05-27`  
**修复方式**：随 M-01 一并修复，在 `getExt` 中补充 `case 'image/x-icon': return 'ico'`。

**文件**：`apps/worker/src/modules/upload/routes.ts`

**描述**：
`ALLOWED_TYPES` 包含 `image/x-icon`，但 `getExt` 函数无对应分支，上传无扩展名的 `.ico` 文件时会被存储为 `.bin`。

**修复方向**：
- 在 `getExt` 中增加 `case 'image/x-icon': return 'ico'`

---

### ✅ B-02 分类 `PUT /:id` 允许将自身设为父分类

**已修复**：`2026-05-27`  
**修复方式**：分类更新时检查 `value.parentId === id`，命中则返回 400，阻止创建自引用分类。

**文件**：`apps/worker/src/modules/category/routes.ts`

**描述**：
更新分类时未检查 `value.parentId === id`，可创建自指向的循环引用，导致前端分类树渲染死循环。

**修复方向**：
- 在业务逻辑中加检查：`if (value.parentId === id) return fail('分类不能将自身设为父级', 400)`

---

### ✅ B-03 错误消息与实际校验逻辑不一致

**已修复**：`2026-05-27`  
**修复方式**：将分类名称长度错误消息改为 `at most 64 characters`，与 `name.length > 64` 的实际校验逻辑保持一致。

**文件**：`apps/worker/src/modules/category/routes.ts`

**描述**：
```typescript
if (!name || name.length > 64) {
  return { error: '...must be less than 64 characters' }  // 实际允许等于 64
}
```
允许长度恰好等于 64，但错误消息写的是"less than 64"（即最多 63）。

**修复方向**：
- 将错误消息改为 `at most 64 characters`，或将校验改为 `name.length >= 64`，与消息保持一致

---

## 后端 · 性能

### ✅ P-01 Dashboard 发起 7 次独立 D1 查询，应使用 `db.batch()` 合并

**已修复**：`2026-05-27`  
**修复方式**：`/admin/dashboard/stats` 将 5 个 COUNT 查询和 2 个最近记录查询合并到一次 `c.env.DB.batch([...])` 调用中，减少 D1 网络往返。

**文件**：`apps/worker/src/modules/dashboard/routes.ts`

**描述**：
5 个 COUNT 查询通过 `Promise.all` 并发，但仍是 5 次独立网络往返，加上后续 2 个查询，共 7 次。D1 提供 `db.batch()` API 可合并为一次往返，显著降低延迟。

**修复方向**：
- 将所有查询改为 `env.DB.batch([stmt1, stmt2, ...])` 统一执行

---

### ✅ P-02 `getSecretKey` 每次 JWT 操作都重新导入密钥，可以缓存

**已修复**：`2026-05-27`  
**修复方式**：新增模块级 `cachedKeys` 缓存，`getSecretKey(secret)` 命中缓存时直接复用 `CryptoKey`，避免同一 Worker 实例中重复 `crypto.subtle.importKey`。

**文件**：`apps/worker/src/utils/jwt.ts`

**描述**：
每次 `signJwt` / `verifyJwt` 都调用 `crypto.subtle.importKey`，在同一 Worker 实例生命周期内（同一请求链）可缓存 `CryptoKey` 对象避免重复计算。

**修复方向**：
- 使用模块级变量（`let cachedKey: CryptoKey | null = null`）缓存已导入的密钥

---

### ✅ P-03 列表接口均无服务端分页

**已修复**：`2026-05-27`  
**修复方式**：后端新增 `parsePagination` 工具，用户、分类、日志列表接口支持 `page/pageSize` 并返回 `{ items, total, page, pageSize }`；前端 API 增加分页结果兼容层，`CategoryList.vue`、`UserList.vue`、`LogList.vue` 改为远程分页。

**文件**：`modules/user/routes.ts`、`modules/category/routes.ts`、`modules/log/routes.ts`、`apps/worker/src/utils/pagination.ts`、`apps/web/src/api/categories.ts`、`apps/web/src/api/users.ts`、`apps/web/src/api/logs.ts`、`apps/web/src/api/types.ts`、`views/admin/CategoryList.vue`、`views/admin/UserList.vue`、`views/admin/LogList.vue`

**描述**：
- 用户列表、分类列表：无 `LIMIT`，全量返回
- 日志列表：硬编码 `LIMIT 100`，无游标/页码，用户无法查看 100 条以外的历史记录

**修复方向**：
- 增加 `page` + `pageSize`（或游标）分页参数
- 同步更新前端列表页支持翻页

---

### ✅ P-04 备份时全量枚举所有 R2 对象，大量文件时可能超时

**已修复**：`2026-05-27`  
**修复方式**：`listR2Objects` 调用 `env.R2.list` 时增加 `prefix: "backups/"`，仅枚举备份目录对象，避免扫描用户上传文件。

**文件**：`apps/worker/src/modules/backup/service.ts`

**描述**：
`listR2Objects` 通过游标循环枚举 Bucket 中所有对象，若存有大量上传图片，会产生大量 R2 API 调用，在 Worker CPU 时间限制（50ms CPU / 30s 实际时间）内可能超时。

**修复方向**：
- 仅枚举 `backups/` 前缀的对象（`prefix: 'backups/'`），或直接将 R2 对象快照从备份内容中移除

---

## 后端 · 代码质量

### ✅ Q-01 `db/client.ts` 中 `getDb` / `getR2` 是从未使用的死代码

**已修复**：`2026-05-27`  
**修复方式**：删除未被引用的 `apps/worker/src/db/client.ts` 文件；全项目检查无 `getDb`、`getR2` 或 `db/client` 引用。

**文件**：`apps/worker/src/db/client.ts`

**描述**：
两个导出函数在整个项目中从未被导入，所有路由直接访问 `c.env.DB` / `c.env.R2`。

**修复方向**：
- 直接删除该文件

---

### ✅ Q-02 `getCookieName` 函数在两处重复定义

**已修复**：`2026-05-27`  
**修复方式**：将 `getCookieName(env)` 提取到 `utils/cookie.ts` 并统一导出，`middleware/auth.ts` 与 `modules/auth/routes.ts` 均改为复用该函数；全项目仅剩一个定义。

**文件**：`modules/auth/routes.ts`、`middleware/auth.ts`、`apps/worker/src/utils/cookie.ts`

**描述**：
两处定义了逻辑完全相同的 `getCookieName(env)` 函数。

**修复方向**：
- 提取到 `utils/cookie.ts` 并统一导出

---

### ✅ Q-03 Base64 转换工具函数在 4 处重复实现

**已修复**：`2026-05-27`  
**修复方式**：新增 `utils/base64.ts`，统一导出 `toBase64`、`fromBase64`、`toBase64Url`、`fromBase64Url`；`backup/service.ts`、`utils/jwt.ts`、`utils/crypto.ts`、`utils/secret.ts` 均改为复用该工具。

**文件**：`modules/backup/service.ts`、`utils/jwt.ts`、`utils/crypto.ts`、`utils/secret.ts`、`apps/worker/src/utils/base64.ts`

**描述**：
项目中有 4 处独立实现的 Base64 编解码函数，缺乏统一的共享工具模块。

**修复方向**：
- 提取到 `utils/base64.ts` 统一导出

---

### ✅ Q-04 `writeOperationLog` 失败会导致主请求返回 500

**已修复**：`2026-05-27`  
**修复方式**：`writeOperationLog` 内部增加 `try/catch`，日志写入失败时记录 `console.error`，不再向调用方抛出异常，避免主业务请求因审计日志失败返回 500。

**文件**：`apps/worker/src/utils/log.ts`

**描述**：
审计日志写入失败（如 D1 临时故障）会直接抛出异常，经 `errorMiddleware` 捕获后向客户端返回 500。即使主业务操作（如创建用户）已成功，用户也会看到错误响应。

**修复方向**：
- 使用 `ctx.waitUntil()` 异步写入日志，或在 `writeOperationLog` 内部 `try/catch` 静默处理日志错误

---

### ✅ Q-05 备份操作未记录操作日志

**已取消**：`2026-05-27`  
**处理说明**：按项目决策，备份操作不需要写入操作日志；已移除此前新增的 `writeOperationLog` 调用，本项不再作为待修复问题处理。

**文件**：`apps/worker/src/modules/backup/routes.ts`

**描述**：
`POST /admin/backups/run` 是高敏感管理操作，但没有调用 `writeOperationLog`，审计日志不完整。

**修复方向**：
- 备份完成后调用 `writeOperationLog` 记录操作人、时间、备份文件 key

---

### ✅ Q-06 日志清理 `beforeDays` 无上限校验

**已修复**：`2026-05-27`  
**修复方式**：日志清理接口增加 `beforeDays > 3650` 上限校验，非法参数返回 400。

**文件**：`apps/worker/src/modules/log/routes.ts`

**描述**：
仅检查 `beforeDays < 1`，无上限。虽然传入极大值只会删除"极旧"的日志，但属于防御性编程缺失。

**修复方向**：
- 增加上限校验，如 `beforeDays > 3650` 时返回 400

---

## 前端 · 安全

### ✅ FS-01 `href` 未过滤 `javascript:` 协议，存在 XSS 风险

**已修复**：`2026-05-27`  
**修复方式**：站点链接统一经过协议白名单过滤，仅允许 `http://` 与 `https://`，其他协议替换为 `#`。

**文件**：`apps/web/src/components/SiteCard.vue`、`views/admin/Dashboard.vue`、`views/admin/SiteList.vue`

**描述**：
两处直接将数据库中的 `url` 字段绑定到 `<a href="...">` 或 `:href`，未做协议白名单校验。若数据库中存有 `javascript:alert(1)` 等内容，用户点击即触发 XSS。

**修复方向**：
- 绑定前校验协议：`url.startsWith('http://') || url.startsWith('https://')`，否则替换为 `#`

---

### ✅ FS-02 上传接口未校验文件 MIME 类型

**已修复**：`2026-05-27`  
**修复方式**：前端 `uploadFile` 增加 MIME 白名单，仅允许 `image/jpeg`、`image/png`、`image/webp`、`image/gif`、`image/x-icon`，与后端允许类型保持一致。

**文件**：`apps/web/src/api/upload.ts`

**描述**：
`uploadFile` 仅校验文件大小（< 1MB），不校验 `file.type`，任何文件（脚本、HTML、可执行文件）只要满足大小限制均可上传。

**修复方向**：
- 上传前在前端检查 `file.type` 是否为允许的图片类型（`image/jpeg`、`image/png`、`image/webp`、`image/gif` 等）

---

## 前端 · Bug

### ✅ FB-01 Dashboard 字段名不一致，分类名和日志时间永远为空

**已修复**：`2026-05-27`  
**修复方式**：Dashboard 模板兼容 `site.categoryName ?? site.category_name` 与 `log.createdAt ?? log.created_at`，API 类型同步补充对应字段。

**文件**：`apps/web/src/views/admin/Dashboard.vue`、`apps/web/src/api/dashboard.ts`

**描述**：
- `recentSites` 访问 `site.category_name`（下划线），但接口返回的是 `categoryName`（驼峰）→ 分类名始终显示"未分类"
- `recentLogs` 访问 `log.created_at`，但接口返回的是 `createdAt` → 日志时间始终为空

**修复方向**：
- 将模板中的 `site.category_name` 改为 `site.category_name ?? site.categoryName`，或统一为驼峰
- 将 `log.created_at` 改为 `log.createdAt`

---

### ✅ FB-02 Favicon 抓取无超时，按钮可永久卡死

**已修复**：`2026-05-27`  
**修复方式**：`handleFetchFavicon` 增加 5 秒超时；优先尝试站点自身 `${origin}/favicon.ico`，失败或超时后 fallback 到 `https://favicon.yandex.net/favicon/${host}`，所有尝试失败时提示用户手动上传；`finally` 统一重置 `fetchingFavicon`。

**文件**：`apps/web/src/views/admin/SiteList.vue`

**描述**：
`handleFetchFavicon` 使用 `new Image().onload` 检测 favicon，若目标服务器无响应，`fetchingFavicon` 永远为 `true`，按钮永远卡在加载状态。此外，服务器返回 HTTP 200 的 HTML 错误页或追踪像素时也会给出假成功。

**修复方向**：
- 添加 `setTimeout` 超时（如 5s）后强制重置 `fetchingFavicon`
- 改用第三方 favicon 服务（如 `https://favicon.yandex.net/favicon/`）以提高成功率

---

### ✅ FB-03 上传成功但后端返回 `data: null` 时 Logo 被清空

**已修复**：`2026-05-27`  
**修复方式**：`SiteList.vue`、`UserList.vue`、`Setting.vue` 上传成功后先校验 `result?.url`，为空时抛出错误并提示用户，不修改原有 logo/avatar 值。

**文件**：`apps/web/src/views/admin/SiteList.vue`、`UserList.vue`、`Setting.vue`

**描述**：
```typescript
form.logo = result?.url || ''  // result 为 null 时 logo 被置空，但仍弹出"上传成功"
```

**修复方向**：
- 检查 `result?.url` 是否有值，无值时弹出错误提示而非成功提示，且不修改 `form.logo`

---

### ✅ FB-04 Logo 图片加载失败无降级处理，显示浏览器破碎图标

**已修复**：`2026-05-27`  
**修复方式**：`SiteCard.vue` 为 logo 图片添加 `@error` 处理，加载失败后隐藏图片并显示 Unicode 安全首字符 fallback；logo 变化时重置失败状态。

**文件**：`apps/web/src/components/SiteCard.vue`

**描述**：
`<img :src="logo">` 没有 `@error` 处理器，图片 404 或跨域失败时显示浏览器默认破碎图标。

**修复方向**：
- 添加 `@error="onImgError"` 处理器，失败时隐藏 img 并显示首字母 Avatar 作为降级

---

### ✅ FB-05 `name.slice(0, 1)` 对 emoji 和某些 Unicode 字符不安全

**已修复**：`2026-05-27`  
**修复方式**：`SiteCard.vue` 与 `Navigation.vue` 均改为使用 `[...value][0] || ''` 按 Unicode code point 安全截取首字符。

**文件**：`apps/web/src/components/SiteCard.vue`、`views/public/Navigation.vue`

**描述**：
Emoji 和部分 CJK 字符由多个 UTF-16 code unit 组成，`.slice(0, 1)` 可能截断代理对，产生乱码。

**修复方向**：
- 改为 `[...name][0] ?? ''`，利用 Unicode 迭代器安全截取第一个字符

---

### ✅ FB-06 `formatDisplayUrl` 使用 `hostname` 丢失端口号

**已修复**：`2026-05-27`  
**修复方式**：`formatDisplayUrl` 已保留端口号，显示时使用掩码后的 host 并在存在 `url.port` 时追加端口。

**文件**：`apps/web/src/views/admin/SiteList.vue`

**描述**：
对 `https://example.com:8443` 类 URL，使用 `url.hostname` 会丢失端口，应改为 `url.host`。

**修复方向**：
- 将 `url.hostname` 替换为 `url.host`

---

### ✅ FB-07 各列表加载失败静默展示空态，无任何错误提示

**已修复**：`2026-05-27`  
**修复方式**：相关 `loadXxx` 函数均补充 `catch`，失败时通过 `message.error('加载失败，请刷新重试')` 或对应提示反馈用户。

**文件**：`views/admin/CategoryList.vue`、`SiteList.vue`、`UserList.vue`、`LogList.vue`、`Dashboard.vue`、`Setting.vue`

**描述**：
所有 `loadXxx` 函数只有 `try/finally`，无 `catch`，API 失败时用户看到的是空列表，无法判断是"真的没有数据"还是"加载出错"。

**修复方向**：
- 在 `catch` 中调用 `message.error('加载失败，请刷新重试')`

---

### ✅ FB-08 删除、保存等操作失败无任何错误反馈

**已修复**：`2026-05-27`  
**修复方式**：保存、删除、重置密码、日志清理、上传等异步操作均补充错误提示，失败时通过 `message.error` 告知用户。

**文件**：`views/admin/CategoryList.vue`、`SiteList.vue`、`UserList.vue`、`LogList.vue`、`Setting.vue`

**描述**：
- `confirmDelete` 的 `onPositiveClick` 无 try/catch
- `handleResetPassword`、`handleSave`、`handleCleanup` 均无 `catch`
- API 失败时对话框已关闭，用户无从得知操作是否成功

**修复方向**：
- 所有异步操作均添加 `catch` 并调用 `message.error` 提示

---

## 前端 · 体验缺陷

### ✅ UX-01 分类父级用文本框手填 ID，体验极差

**已修复**：`2026-05-27`  
**修复方式**：父级分类字段已改为 `n-select`，选项来自当前分类列表，并自动排除正在编辑的分类自身。

**文件**：`apps/web/src/views/admin/CategoryList.vue`

**描述**：
创建/编辑分类时，父级字段使用 `n-input` 手动填写 UUID，用户必须事先知道目标分类的 ID。页面已有 `categories` 数据。

**修复方向**：
- 改为 `n-select`，选项来自已有分类列表，value 为 id，label 为 name

---

### ✅ UX-02 分类列表卡片中父级直接显示 UUID

**已修复**：`2026-05-27`  
**修复方式**：新增 `parentName(parentId)`，桌面表格和移动卡片均优先展示父级分类名称，找不到时才回退显示原始 ID。

**文件**：`apps/web/src/views/admin/CategoryList.vue`

**描述**：
`category.parentId` 直接展示原始 UUID，用户无法理解。

**修复方向**：
- 在展示时根据 `parentId` 从分类列表中查找对应 `name` 显示

---

### ✅ UX-03 日志清理操作无二次确认，误触可不可逆批量删除

**已修复**：`2026-05-27`  
**修复方式**：日志清理改为通过 `dialog.warning` 二次确认，并明确提示该操作不可恢复。

**文件**：`apps/web/src/views/admin/LogList.vue`

**描述**：
"清理 90 天前日志"直接点击执行，无任何确认对话框。

**修复方向**：
- 添加 `n-dialog` 二次确认，明确提示操作不可逆

---

### ✅ UX-04 管理员账号无删除保护

**已修复**：`2026-05-27`  
**修复方式**：用户列表根据当前登录用户和活跃管理员数量禁用删除按钮，禁止删除当前登录用户和唯一活跃管理员；点击保护项时给出原因提示。后端原有删除保护仍作为最终兜底。

**文件**：`apps/web/src/views/admin/UserList.vue`

**描述**：
状态切换对 `admin` 角色做了 `disabled` 保护，但删除按钮对管理员账号同样可点，误操作可能删除唯一管理员账号。

**修复方向**：
- 对当前登录用户自身和唯一管理员账号禁用删除按钮

---

### ✅ UX-05 用户状态切换无确认步骤

**已修复**：`2026-05-27`  
**修复方式**：用户状态 Switch 触发后先弹出二次确认对话框，用户确认后才调用更新接口。

**文件**：`apps/web/src/views/admin/UserList.vue`

**描述**：
直接切换 Switch 即触发账号启用/禁用，与需要确认对话框的删除操作交互不一致。

**修复方向**：
- 添加二次确认对话框，或改为在编辑表单中修改状态

---

### ✅ UX-06 删除确认对话框确认按钮无加载态，可重复点击

**已修复**：`2026-05-27`  
**修复方式**：分类、站点、用户删除确认均保存 `dialog.warning` 返回的实例，在异步删除期间设置 `dialogInstance.loading = true`，完成后恢复，避免重复点击。

**文件**：`views/admin/CategoryList.vue`、`SiteList.vue`、`UserList.vue`

**描述**：
`onPositiveClick` 是异步函数，但 Naive UI dialog 无法感知 Promise 状态，确认按钮无加载反馈，用户可能重复点击导致重复请求。

**修复方向**：
- 使用 `n-dialog` 的 `loading` 属性，或改为自定义 Modal + 手动控制 loading 状态

---

### ✅ UX-07 设置页无脏状态检测，保存按钮始终可用

**已修复**：`2026-05-27`  
**修复方式**：设置页维护 `originalForm`，通过 `isDirty` 对比当前表单与初始值，未修改时禁用保存按钮，保存成功后同步更新初始值。

**文件**：`apps/web/src/views/admin/Setting.vue`

**描述**：
未修改任何内容时也可点击"保存设置"，产生无意义请求，且用户无法感知"当前是否有未保存的更改"。

**修复方向**：
- 将初始值深拷贝为 `originalForm`，通过对比检测脏状态，未修改时禁用保存按钮

---

### ✅ UX-08 `resetForm` 中默认 `categoryId` 存在竞态，可能为空

**已修复**：`2026-05-27`  
**修复方式**：新增站点前若分类列表为空会先重新加载分类；仍无分类时提示用户先创建或加载分类，不再打开空分类表单。

**文件**：`apps/web/src/views/admin/SiteList.vue`

**描述**：
`openCreate` → `resetForm` 依赖 `categories.value[0]?.id`，若 `loadCategories` 尚未完成，默认 `categoryId` 为空字符串，用户打开表单时无默认分类。

**修复方向**：
- 在 `openCreate` 前确保分类已加载，或在 `resetForm` 中做非空判断

---

## 前端 · 代码质量

### ✅ FQ-01 `ApiResponse<T>` 接口在 6 个 API 文件中重复定义

**已修复**：`2026-05-27`  
**修复方式**：`ApiResponse<T>` 统一由 `api/http.ts` 导出，API 文件和 `auth` store 均改为 `import type ApiResponse` 复用；全前端仅保留一个接口定义。

**文件**：`api/http.ts`、`api/categories.ts`、`api/sites.ts`、`api/users.ts`、`api/settings.ts`、`api/logs.ts`、`api/upload.ts`、`api/public.ts`、`stores/auth.ts`

**描述**：
6 个文件各自定义了结构完全相同的 `interface ApiResponse<T>`，与 `packages/shared/src/index.ts` 中已有的定义重复。

**修复方向**：
- 从 `api/http.ts` 或 `@cloud-blog-lite/shared` 统一导出，各文件改为 `import`

---

### ✅ FQ-02 `theme.ts` store 直接操作 DOM 无环境守卫，SSR 环境会崩溃

**已修复**：`2026-05-27`  
**修复方式**：新增 `hasBrowserEnv()`，`getInitialTheme()`、`applyTheme()`、`setupSystemThemeListener()` 均在访问 `window` / `document` / `localStorage` 前做环境守卫。

**文件**：`apps/web/src/stores/theme.ts`

**描述**：
`getInitialTheme()` 调用 `window.matchMedia`，`applyTheme()` 调用 `document.documentElement` 和 `localStorage`，均在 store 构造时同步执行，在 SSR 或单元测试环境中会因 `window` / `document` 未定义而抛异常。

**修复方向**：
- 添加 `typeof window !== 'undefined'` 守卫

---

### ✅ FQ-03 `theme.ts` 未订阅系统主题变更事件

**已修复**：`2026-05-27`  
**修复方式**：`theme.ts` 已订阅 `prefers-color-scheme` 的 `change` 事件；默认跟随系统主题时不再把系统推导出的主题写入 `localStorage`，避免监听器因本地偏好存在而失效。

**文件**：`apps/web/src/stores/theme.ts`

**描述**：
初始化时读取一次 `prefers-color-scheme`，但未注册 `matchMedia.addEventListener('change', ...)` 监听器，用户在会话期间切换系统主题时 App 不会跟随。

**修复方向**：
- 在 store 初始化时注册 `change` 监听器，自动同步系统主题变化

---

## 修复优先级建议

| 优先级 | 条目 | 原因 |
|---|---|---|
| 🔴 立即 | C-01、C-02 | 数据泄露风险，上线前必须修复 |
| 🔴 立即 | H-01、H-06 | 生产环境弱密钥可能已生效，需紧急检查 |
| 🟠 本周 | H-02、H-03、H-04、FB-01 | 安全加固 + 明显 Bug，成本低收益高 |
| 🟡 近期 | M-01 ~ M-05、FB-02 ~ FB-08 | 功能完善和体验提升 |
| 🟢 排期 | P-01 ~ P-04、Q-01 ~ Q-06、FQ-01 ~ FQ-03 | 代码质量和性能优化，影响范围可控 |
