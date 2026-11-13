# Lumi JSON API

独立的 Lumi 演示数据服务，使用零依赖 Node.js 实现。它提供 Pro 演示所需的资源、认证、批量操作、上传和仪表盘接口，响应格式与 `createSimpleDataProvider` 一致。

## 启动

```bash
pnpm --dir apps/json-api dev
```

默认地址为 `http://127.0.0.1:3003`，也可以通过 `PORT` 修改端口。

演示账号：

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | 任意非空密码 | 管理员 |
| `manager` | 任意非空密码 | 运营经理 |
| `support` | 任意非空密码 | 客服 |

## 主要接口

```text
POST /login                 登录
POST /register              注册演示用户
POST /logout                退出当前会话
GET  /me                    当前用户和权限
GET  /dashboard             仪表盘聚合数据
GET  /:resource             分页、筛选、排序列表
GET  /:resource/:id         详情
POST /:resource             创建
PUT/PATCH /:resource/:id   更新
DELETE /:resource/:id       删除
POST /:resource/batch       批量创建、更新或删除
POST /upload                文件上传演示
GET  /health                健康检查（无需登录）
```

列表响应为 `{ data: [], meta: { total, page, pageSize } }`，不传 `page` / `pageSize` 时返回全部匹配记录；单条响应为 `{ data: {} }`。批量请求示例：

```json
{
  "action": "delete",
  "ids": [1, 2, 3]
}
```

批量创建使用 `action: "create"` 和 `data` 数组；批量更新使用 `action: "update"`、`ids` 和 `data`。列表请求携带 `ids[]=1&ids[]=2` 即可作为 `getMany` 使用。

服务使用内存数据，重启后恢复种子数据。它适合文档、Playground、CDN Admin 和本地开发；生产环境请替换为自己的 API，并自行处理持久化、租户隔离、限流、审计和真实认证。

需要自动化重置演示数据时，在服务端配置 `LUMI_RESET_TOKEN`，再携带同值的 `X-Lumi-Reset-Token` 请求 `POST /__reset`。未配置 token 时该端点不存在，避免公网演示被任意重置。
