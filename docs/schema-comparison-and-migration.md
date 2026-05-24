# 旧 MySQL 表结构与 Cloudflare D1 轻量版表结构对比

## 1. 对比来源

旧系统 SQL 文件：

```text
D:\project\zed\yun-blog\db\blog_20260524_010001.sql
```

当前轻量版 D1 migration：

```text
D:\project\zed\cloud-blog-lite\apps\worker\migrations\0001_initial.sql
```

本文件用于明确：

- 哪些旧表进入轻量版第一版；
- 哪些旧表合并；
- 哪些旧表删除或后置；
- 哪些字段需要映射；
- 哪些字段存在安全风险，不建议直接迁移。

---

## 2. 旧系统表清单

从 `blog_20260524_010001.sql` 提取到的旧表：

| 旧表 | 字段 |
|---|---|
| `category` | `id`, `parentId`, `sort`, `title`, `icon`, `levels`, `createTime`, `updateTime`, `inputUserId` |
| `site` | `id`, `categoryId`, `title`, `thumb`, `description`, `url`, `createTime`, `updateTime`, `inputUserId`, `account`, `password` |
| `operate_log` | `id`, `userName`, `userId`, `operation`, `description`, `params`, `operateIp`, `inputTime` |
| `t_user` | `id`, `name`, `avatar`, `idNo`, `remark`, `deptId`, `inputUserId`, `inputTime` |
| `t_user_identity` | `id`, `userId`, `identityType`, `identifier`, `credential`, `state`, `lastLoginTime`, `errorCount` |
| `t_user_role` | `id`, `userId`, `roleId` |
| `t_role` | `id`, `code`, `name`, `state`, `remark`, `inputUserId`, `inputTime` |
| `t_role_menu` | `id`, `roleId`, `menuId` |
| `t_menu` | `id`, `name`, `pid`, `code`, `description`, `pageUrl`, `type`, `state`, `showIndex`, `inputTime`, `imagePath`, `imageCss`, `childCss` |
| `t_dept` | `id`, `deptName`, `pid`, `pname`, `code`, `level`, `inputUserId`, `inputTime`, `remark` |
| `t_notify` | `id`, `title`, `content`, `status`, `file`, `remark`, `inputUserId`, `inputTime` |
| `t_notify_user` | `id`, `notifyId`, `userId`, `isRead`, `readTime` |
| `t_tml` | `id`, `code`, `name`, `pcode`, `pname`, `type`, `remark`, `longitude`, `latitude`, `inputTime` |
| `worker_info` | `id`, `name`, `idNo`, `phone`, `birthday`, `address`, `gender`, `deptId`, `deptName`, `inputUserId`, `inputTime`, `head` |

---

## 3. 当前 D1 第一版表清单

当前轻量版已建 D1 表：

| D1 表 | 字段 |
|---|---|
| `users` | `id`, `username`, `password_hash`, `nickname`, `avatar`, `role`, `status`, `last_login_at`, `created_at`, `updated_at` |
| `categories` | `id`, `name`, `icon`, `sort`, `visible`, `created_at`, `updated_at` |
| `sites` | `id`, `category_id`, `name`, `url`, `description`, `logo`, `sort`, `visible`, `created_at`, `updated_at` |
| `settings` | `key`, `value`, `updated_at` |
| `operation_logs` | `id`, `user_id`, `action`, `module`, `detail`, `ip`, `user_agent`, `created_at` |

---

## 4. 表级映射结论

| 旧表 | D1 表 | 第一版处理 | 说明 |
|---|---|---|---|
| `category` | `categories` | 保留并调整 | 导航分类核心表，需要补充父级字段 |
| `site` | `sites` | 保留并调整 | 导航站点核心表，需要谨慎处理 `account/password` |
| `operate_log` | `operation_logs` | 保留并简化 | 字段语义基本一致，日志可不迁移历史数据 |
| `t_user` + `t_user_identity` | `users` | 合并 | 轻量版不再拆基础信息和登录身份 |
| `t_role` + `t_user_role` | `users.role` 或后续 `roles` | 第一版简化 | 第一版采用 `admin/editor/viewer` 字符串角色 |
| `t_menu` + `t_role_menu` | 暂无 | 第一版不迁移 | 旧 Shiro 菜单权限较重，轻量版先用固定路由和角色 |
| `t_dept` | 暂无 | 后置/不迁移 | 部门管理非导航核心功能 |
| `t_notify` + `t_notify_user` | 暂无 | 后置 | 通知模块第一版不做 |
| `t_tml` | 暂无 | 后置/不迁移 | 区域/模板类功能第一版不做 |
| `worker_info` | 暂无 | 后置/不迁移 | 员工信息和 Excel 导入不进入轻量第一版 |

---

## 5. 字段级对比和建议

### 5.1 `category` -> `categories`

旧表：

```text
category: id, parentId, sort, title, icon, levels, createTime, updateTime, inputUserId
```

当前 D1：

```text
categories: id, name, icon, sort, visible, created_at, updated_at
```

当前缺失字段：

| 旧字段 | 是否建议加入 | D1 字段建议 | 说明 |
|---|---:|---|---|
| `parentId` | 是 | `parent_id` | 旧分类存在父子层级，必须保留，否则导航层级会丢失 |
| `levels` | 是 | `level` | 可用于快速展示层级，虽然也可由父级计算 |
| `inputUserId` | 可选 | `created_by` | 后台审计可用，第一版可保留 |
| `title` | 已映射 | `name` | 字段改名即可 |
| `createTime` | 已映射 | `created_at` | 时间格式改为 ISO 字符串 |
| `updateTime` | 已映射 | `updated_at` | 时间格式改为 ISO 字符串 |

建议调整 D1：

```text
categories 增加 parent_id、level、created_by
```

---

### 5.2 `site` -> `sites`

旧表：

```text
site: id, categoryId, title, thumb, description, url, createTime, updateTime, inputUserId, account, password
```

当前 D1：

```text
sites: id, category_id, name, url, description, logo, sort, visible, created_at, updated_at
```

当前缺失字段：

| 旧字段 | 是否建议加入 | D1 字段建议 | 说明 |
|---|---:|---|---|
| `inputUserId` | 可选 | `created_by` | 后台审计可用 |
| `account` | 谨慎 | 不建议直接放 `sites` | SQL 中已有真实账号数据，属于敏感信息 |
| `password` | 谨慎 | 不建议明文迁移 | SQL 中已有真实密码/密钥类数据，安全风险高 |
| `thumb` | 已映射 | `logo` | 站点 logo，路径需从 `/file/logo/...` 迁移到 R2 |
| `title` | 已映射 | `name` | 字段改名即可 |

当前 D1 新增但旧表没有：

| D1 字段 | 说明 |
|---|---|
| `sort` | 旧 `site` 没有站点排序字段，第一版可保留，默认 0 |
| `visible` | 旧 `site` 没有可见状态，第一版可保留，默认 1 |

敏感字段建议：

旧 `site.account` 和 `site.password` 中包含邮箱、订阅链接、登录密码、提示词等敏感信息，**不建议直接作为公开站点表字段迁移**。

可选处理方案：

1. 第一版不迁移 `account/password`，只迁移站点展示数据；
2. 后续如确实需要“私密账号备注”，新增独立表 `site_secrets`；
3. `site_secrets` 必须仅管理员可访问；
4. 密码类字段不能明文返回前端；
5. 如要存储，至少做加密存储，并把加密密钥放 Cloudflare Secret。

建议第一版：

```text
sites 增加 created_by
不把 account/password 放入 sites
```

---

### 5.3 `operate_log` -> `operation_logs`

旧表：

```text
operate_log: id, userName, userId, operation, description, params, operateIp, inputTime
```

当前 D1：

```text
operation_logs: id, user_id, action, module, detail, ip, user_agent, created_at
```

映射建议：

| 旧字段 | D1 字段 | 说明 |
|---|---|---|
| `id` | `id` | 保留 |
| `userId` | `user_id` | 保留 |
| `userName` | `username` | 建议 D1 增加，方便日志展示 |
| `operation` | `action` | 操作名称 |
| `description` | `module` 或 `description` | 当前 `module` 不够准确，建议增加 `description` |
| `params` | `detail` | JSON 字符串即可 |
| `operateIp` | `ip` | 保留 |
| `inputTime` | `created_at` | 时间格式转换 |

建议调整 D1：

```text
operation_logs 增加 username、description
```

历史操作日志数据量较大，第一版建议不迁移历史日志，只保留新系统日志。

---

### 5.4 `t_user` + `t_user_identity` -> `users`

旧表：

```text
t_user: id, name, avatar, idNo, remark, deptId, inputUserId, inputTime
t_user_identity: id, userId, identityType, identifier, credential, state, lastLoginTime, errorCount
```

当前 D1：

```text
users: id, username, password_hash, nickname, avatar, role, status, last_login_at, created_at, updated_at
```

映射建议：

| 旧字段 | D1 字段 | 说明 |
|---|---|---|
| `t_user.id` | `users.id` | 保留原 ID 或转字符串 |
| `t_user.name` | `users.nickname` | 昵称 |
| `t_user.avatar` | `users.avatar` | 头像路径后续迁移到 R2 |
| `t_user_identity.identifier` | `users.username` | 登录名 |
| `t_user_identity.credential` | 不直接迁移为可用密码 | 旧系统疑似 MD5，建议重置密码 |
| `t_user_identity.state` | `users.status` | `Y -> 1`，`N -> 0` |
| `t_user_identity.lastLoginTime` | `users.last_login_at` | 保留 |
| `t_user_identity.errorCount` | `users.login_error_count` | 建议加入 |
| `t_user.remark` | `users.remark` | 可选加入 |
| `t_user.deptId` | 不迁移/后置 | 第一版不做部门 |
| `t_user.idNo` | 不建议迁移 | 身份证号敏感，轻量版不需要 |

建议调整 D1：

```text
users 增加 remark、login_error_count
不迁移 idNo、deptId
旧 credential 不直接复用，迁移时统一重置密码
```

---

### 5.5 角色和权限表

旧表：

```text
t_role: id, code, name, state, remark, inputUserId, inputTime
t_user_role: id, userId, roleId
t_menu: id, name, pid, code, description, pageUrl, type, state, showIndex, inputTime, imagePath, imageCss, childCss
t_role_menu: id, roleId, menuId
```

当前 D1：

```text
users.role
```

第一版建议不迁移旧菜单权限表。

原因：

- 旧权限模型是 Shiro + 菜单 + 功能点；
- 新系统第一版页面少，固定角色足够；
- 迁移旧菜单会把轻量版重新复杂化；
- 后续如需要按钮级权限，再设计 `roles`、`permissions`、`user_roles`。

第一版角色映射建议：

| 旧角色 | 新角色 |
|---|---|
| 超级管理员/管理员 | `admin` |
| guide/网站导航用户 | `editor` 或 `viewer`，按实际需求决定 |
| 其他角色 | `viewer` 或不迁移 |

---

## 6. 当前 D1 表需要调整的地方

基于旧表对比，建议第一版对 `0001_initial.sql` 做以下调整：

### 6.1 `categories` 建议补充

```text
parent_id TEXT NOT NULL DEFAULT '0'
level INTEGER
created_by TEXT
```

### 6.2 `sites` 建议补充

```text
created_by TEXT
```

不建议直接补充：

```text
account
password
```

如果后续确实需要账号密码管理，建议新增：

```text
site_secrets
```

但不进入第一版公开导航功能。

### 6.3 `users` 建议补充

```text
remark TEXT
login_error_count INTEGER NOT NULL DEFAULT 0
```

不建议补充：

```text
id_no
dept_id
```

### 6.4 `operation_logs` 建议补充

```text
username TEXT
description TEXT
```

---

## 7. 建议的第一版最终 D1 表

第一版建议仍然保持 5 张核心表：

```text
users
categories
sites
settings
operation_logs
```

但需要比当前 migration 略微补充字段：

```text
categories 增加 parent_id、level、created_by
sites 增加 created_by
users 增加 remark、login_error_count
operation_logs 增加 username、description
```

暂不引入：

```text
roles
user_roles
menus
role_menus
depts
notifies
notify_users
tmls
worker_infos
site_secrets
```

---

## 8. 数据迁移策略

### 8.1 迁移分类

```text
category.id          -> categories.id
category.parentId    -> categories.parent_id
category.title       -> categories.name
category.icon        -> categories.icon
category.sort        -> categories.sort
category.levels      -> categories.level
category.inputUserId -> categories.created_by
category.createTime  -> categories.created_at
category.updateTime  -> categories.updated_at
```

### 8.2 迁移站点

```text
site.id          -> sites.id
site.categoryId  -> sites.category_id
site.title       -> sites.name
site.url         -> sites.url
site.description -> sites.description
site.thumb       -> sites.logo
site.inputUserId -> sites.created_by
site.createTime  -> sites.created_at
site.updateTime  -> sites.updated_at
```

不迁移：

```text
site.account
site.password
```

原因：包含敏感账号密码和订阅信息，不适合直接进入公开导航表。

### 8.3 迁移用户

```text
t_user.id                    -> users.id
t_user.name                  -> users.nickname
t_user.avatar                -> users.avatar
t_user.remark                -> users.remark
t_user.inputTime             -> users.created_at
t_user_identity.identifier   -> users.username
t_user_identity.state        -> users.status
t_user_identity.lastLoginTime -> users.last_login_at
t_user_identity.errorCount   -> users.login_error_count
```

密码处理：

```text
不直接复用 t_user_identity.credential
迁移后统一重置为临时密码
用户首次登录后再修改密码
```

### 8.4 操作日志

第一版建议不迁移旧日志。

如果确实要迁移：

```text
operate_log.id          -> operation_logs.id
operate_log.userId      -> operation_logs.user_id
operate_log.userName    -> operation_logs.username
operate_log.operation   -> operation_logs.action
operate_log.description -> operation_logs.description
operate_log.params      -> operation_logs.detail
operate_log.operateIp   -> operation_logs.ip
operate_log.inputTime   -> operation_logs.created_at
```

---

## 9. 当前调整状态

已完成：

- 已按本文件建议更新 `D:\project\zed\cloud-blog-lite\apps\worker\migrations\0001_initial.sql`；
- 已重新执行本地 D1 migration；
- 本地 migration 执行结果：`18 commands executed successfully`；
- 已重新执行 Worker 类型检查，结果通过。

更新后的第一版 D1 表仍为：

```text
users
categories
sites
settings
operation_logs
```

已补充字段：

```text
categories.parent_id
categories.level
categories.created_by
sites.created_by
users.remark
users.login_error_count
operation_logs.username
operation_logs.description
```

明确不进入第一版的敏感字段：

```text
site.account
site.password
```

原因：旧 SQL 中包含真实账号、密码、订阅链接、提示词等敏感数据，不适合直接迁移进公开导航站点表。

---

## 10. 下一步建议

在继续第 6 步“初始化 admin 用户”前，建议先调整 D1 migration：

```text
1. 修改 migrations/0001_initial.sql
2. 删除本地旧 D1 状态或新建第二个 migration
3. 重新执行本地 migration
4. 再继续初始化 admin
```

由于当前项目还处于初始阶段，本地 D1 没有业务数据，建议直接修改 `0001_initial.sql` 并重置本地 D1。
