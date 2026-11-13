# Admin A 方案落地与会话续接

日期：2026-09-21。

## 原会话总结

续接会话 `01a0b781-c487-7d11-a9a4-6d37127d1ac0`。已读取本地会话记录，并以当前工作区为准保留已有迁移与未跟踪文件。

1. 确认直接使用原生 json-render，不保留旧页面协议或兼容转换层。产品分为 Lumi 服务、Lumi UI、Lumi Admin，中立入口与 React 入口隔离，未来可增加 Vue 实现。
2. 完成六包迁移，移除旧 Vue、自研渲染链及 Rust/WASM；运行时、CLI、MCP、文档和脚手架共用 Catalog。此前迁移验收见 `native-json-render-2026-09-19.md`，属于历史结果。
3. Admin 示例、文档和 playground 已迁移；默认页面统一为居中、最大 1280px 的自适应内容轴。
4. 用户比较临时设计稿后，为表单和列表均选择 A 分区卡片，要求符合 Vercel / Geist 方向，并通过统一 token 控制文字、圆角等样式。
5. 原会话已修改主要页面及 token，但在浏览器验收期间因会话认证错误中断，没有完成最终交付。

## 本次完成范围

- 承接现有 A 方案：列表统计、筛选、结果独立成卡；表单的 centered / tabs / steps / publish 共用分组卡片，可按实际内容配置辅助栏。
- 保留统一宽度、移动端单列、抽屉、保存、分步校验、未保存离开拦截及列表刷新行为。
- 公共 token 位于 `packages/ui/src/tokens.css`，随编译后的 UI 样式发布；UI 与 Admin 共用字号、字重、圆角、间距及控件尺寸。补齐卡片列表仍直接声明的字号、字重和间距。
- 默认字号、间距和控件尺寸改为 rem，跟随根字号缩放；显式字号种子仍可单独覆盖。新增浏览器断言验证默认值、全局缩放和明暗模式下的 token 联动。
- 修正旧火花图断言，验证四张真实统计卡；保持数据与行为断言。修复浅色工作区 Frame 说明文字的对比度不足，沿用现有语义色。
- 更新视觉规范、包文档与已有 Changeset。临时方案预览及临时测试配置移至 `/private/tmp/lumi-admin-design-2026-09-21-archive`，正式视觉基线仅保留 Lumi 实现截图。

## 验收

以下均为本次实际运行结果：

| 检查 | 结果 |
| --- | --- |
| `pnpm typecheck` / `pnpm lint` | 通过 |
| `pnpm test` | 40 个测试文件、306 项测试通过 |
| `pnpm build` / `pnpm check:schema` | 全仓构建通过；checker 10 项测试通过 |
| `pnpm e2e` | 34 项全部通过，无重试；覆盖 React 示例、foundation-admin、文档、playground、Admin |
| Admin 视觉与可访问性 | 14 类页面 × 3 种尺寸 × 明暗主题，共 84 张截图与 axe 检查通过 |
| `pnpm verify:assets` | 84 张基线清单通过，本次同步更新 57 个条目 |
| `pnpm verify:upstream:offline` / `pnpm verify:generated` | 25 个受保护上游源码及生成物检查通过 |
| `node scripts/verify-package-tarballs.mjs` | 六包产物清单通过，包含编译样式与 token 源码 |
| `pnpm verify:size` / `pnpm verify:release-guard` | 现有体积预算、Changesets 发布门禁通过 |

浏览器验收还覆盖 320 / 768 / 1440 / 2560px 的内容轴、表单与卡片列表布局，以及真实 CRUD、筛选分页、分步提交、脏状态拦截和路由抽屉。

中间一次回归与全仓构建同时运行时发生登录页面加载超时；停止重叠构建后，从全新测试服务器完整运行 `pnpm e2e`，34 项均通过。没有放宽截图差异阈值或跳过可访问性检查。

开发入口：`http://127.0.0.1:5176/`，mock 服务端口 3002，示例账号 `admin` / `admin`。
