# 原生 json-render 迁移实施记录

> 注：2026-11-05 改为只做 React 后，本记录里的导入路径已被批量改成新写法（原 `@duxweb/lumi*/react` 现为各包根入口）。其余内容为当时的原始记录。

日期：2026-09-19。唯一架构方案为 [plan/README.md](../plan/README.md)。本记录说明交付和实际验收，不替代架构规则。

## 交付

- 产品为 `@duxweb/lumi`、`@duxweb/lumi-ui`、`@duxweb/lumi-admin` 三层；加上 check、mcp、create 共六包。中立根入口与 `/catalog` 定义不导入 React，框架实现位于 `/react`，图表位于 UI `/react/charts`。
- 删除旧 core/schema/runtime/react/vue 包；UI/Admin 改目录和包名；移除自研 RendererContract、旧节点解释器、Rust/WASM 协议引擎。原始未提交实现先完整快照，再迁移行为；没有从 Git HEAD 覆盖工作区。
- 原生 Spec/Catalog/Registry/StateStore、绑定、事件、watch、handlers 直接沿用上游。纯 UI 可在原生 JSONUIProvider/Renderer 下使用，LumiProvider 只是可选装配。
- 请求、CRUD、查询失效、认证共享服务供 hooks 和 JSON actions 使用。Query 处理初始和依赖变化加载；单 Store 承担可编辑值；提交等待异步业务校验并防重入、保留字段错误，成功后才关闭。
- 保留草稿/dirty/分步校验、聚合快照、会话隔离、上传取消、受保护的路由抽屉、Shell 挂载稳定性及全部 React 页面。useSelect 直接接收 resource/dataProviderName，删除旧 optionsResource 包装类型。
- 29 个 UI 定义、42 个完整 Admin Catalog 组件；MCP 只保留目录查询、组件描述、共享校验三个工具。CLI、自定义 Catalog、运行时和文档共用 definitions。
- React demo、Admin demo、foundation-admin、gallery、playground、文档、脚手架和发布检查完成切换；旧任务归档；一个仓库规则源和一个 Lumi skill。

## 最终验收

代码已同步至 `/Volumes/Web/dux-js`。以开始时的完整工作区快照作三方比较，975 项写入/删除没有并发编辑冲突；保留原有未提交内容的迁移结果，没有 reset、clean、提交或发布操作。后续修正直接在实际仓库完成。

| 检查 | 结果 |
| --- | --- |
| `pnpm verify:ci` | 实际仓库完整通过，包含以下质量、构建和发布前门禁 |
| typecheck / lint / test | 全部通过；含 Astro 类型检查；40 个测试文件、306 项测试 |
| check:schema | TypeScript CLI / runtime 同源校验，10 项通过（属于上面的回归集） |
| build / generated / docs-base | 全工作区构建、同源文档生成、示例校验和类型、根路径与 `/lumi/` 链接检查通过 |
| pack / isolation | 六个真实 tarball；中立入口和 UI 单独安装不装 React；原生与便捷 Provider 编辑绑定等价；Node CLI/MCP 独立安装及实际 CLI 执行通过 |
| create-lumi / publint / attw | 仓外生成项目的严格 peer 安装、类型检查、生产构建及六包 ESM 入口验证通过 |
| upstream / assets / size / release guard | 25 个来源固定的 UI 文件、许可、84 张自产图、全部具名 JS/CSS chunk 和 Changesets 发布拦截通过 |
| `CI=1 pnpm e2e` | 实际仓库完整通过：33 项 Chromium 测试；桌面/平板/手机、明暗主题、84 张原视觉基线和 axe 检查 |
| 其他 | JSON API 的 8 项业务测试通过；MCP 独立 test 命令通过；本地 Lumi skill 校验通过；`git diff --check` 通过 |

验收发现并修复了异步 Select 空值事件导致抽屉误报 dirty、Query 初次加载使 Table 收到 null、上传取消以及旧会话响应回写的问题。Select 和 Query→Table 已用失败到通过的回归验证；相关测试全部通过，84 张原基线保持不变。

Vue 的运行时实现、入口、测试和直接依赖均已删除。开发用 eslint-config 的传递依赖仍包含 Vue 语法工具；产品和发布物不使用它们，没有为清理传递开发依赖而替换无关工具。

## 依赖与包体积

json-render core/react 固定 0.21.0，Zod 4.3.6，TanStack Query core/react-query 同为 5.101.2。框架运行时保持 optional peers + devDependencies；Node 工具独立安装。checker 仅打包上游未修改的框架无关 schema，保留 Apache-2.0 许可证，避免 Node 工具安装 React。

体积检查按新中立入口/React Registry/延迟图表分块逐项约束，没有跳过未识别 chunk。Admin 主包 gzip 从旧 351492 字节增至 395883 字节（上游 Renderer/Catalog 与共享 Zod 校验）；预算为 440000 字节。图表大引擎仍延迟加载，原始 84 张视觉基线不重置。

## 使用入口

- 普通 UI：`@duxweb/lumi-ui` 的 `uiRegistry` + 上游 `JSONUIProvider` / `Renderer`，导入 `@duxweb/lumi-ui/style.css`。
- 数据页面：配置 `createLumi({ dataProvider, authProvider, ... })`，使用 `@duxweb/lumi`；认证只在 Lumi context 配置，REST transport 不重复处理会话。
- Admin：`@duxweb/lumi-admin` 的 `createAdmin`，显式路由 `{ page: { spec } }` / `{ page: { src } }`，自定义扩展仍用上游 defineCatalog/defineRegistry。
- 新项目：`pnpm create @duxweb/lumi my-app`。当前只交付 React；未来 Vue 复用纯服务、定义与主题，仍需自己的 Vue UI/hooks/Shell 实现。
