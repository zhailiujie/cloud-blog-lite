# 数据库 Migration 说明

项目的 D1 migration 位于 `apps/worker/migrations/`。

| 文件/结构 | 说明 |
| --- | --- |
| `0001_initial.sql` | 初始化用户、分类、站点、设置、操作日志表 |
| `sites.is_pinned` | 站点置顶字段，当前线上已应用 |
| `sites.click_count`、`sites.last_clicked_at` | 站点点击统计字段，当前线上已应用 |
| `tags`、`site_tags` | 标签系统表，当前线上已应用 |
| `sites.health_status`、`sites.http_status`、`sites.last_checked_at`、`sites.health_error` | 站点健康检查字段，当前线上已应用 |

部署到生产前执行：

```bash
pnpm d1:migrate:remote
```

本地开发执行：

```bash
pnpm d1:migrate:local
```
