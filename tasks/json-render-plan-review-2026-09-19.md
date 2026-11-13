# json-render 迁移方案复审记录

日期：2026-09-19。本文是问题与决策记录，不是第二份开发计划；执行以 [plan/README.md](../plan/README.md) 为准。审查覆盖现有包、数据/表单/动作边界、checker、8 个 MCP 工具、仓库 skills/规则、脚手架及视觉规范。

结论：保留 Lumi / UI / Admin 三层和当前 React 交付方向。工具保留为可选的薄入口；删除自研协议及重复执行器。以下问题已修订到计划，产品实现仍待 P1–P5，不能将“计划已修正”当成运行行为已通过。

| 影响 | 发现与证据 | 已确定的处理 |
| --- | --- | --- |
| 高 | 计划将上游字段校验与业务异步校验混为一谈；原生 validateForm 不阻止后续 submit，当前核对的 ValidationFunction 返回 boolean | Lumi submitForm 等待业务校验；无效零提交，成功后才关闭；补分步/多表单与异步竞态验收，见计划 §4.4/7.1 |
| 高 | 顺序 action 数组不等于事务，错误被处理后后续动作仍可能运行；按动作名称的 loading 也不能隔离并发提交 | 保存/关闭明确成功边界；按表单防重入，刷新失败不重复保存；不重建动作 DSL |
| 高 | 原计划仅说“统一校验”，没有区分动态 Spec 与解析后业务参数，自定义 Catalog 和 Node 加载也可能到 P4 才暴露问题 | 共享上游 Catalog/schema/validateSpec；表达式在静态阶段合法，Lumi handler 执行时再校验实际参数；P1 验证自定义 Catalog、CLI/MCP 与真实打包入口 |
| 高 | 查询结果“只读”并非 StateStore 保证；多个连接组件、旧响应、会话/记录切换可能覆盖状态 | 一个 Query 读取入口、一个结果路径写入者、共享 QueryClient、快照与生命周期保护；不另造受限 Store/缓存 |
| 中 | 现有 schema、Rust、WASM、MCP Zod 定义多处维护同一旧协议 | 删除旧协议引擎和 parity 生成链；CLI/MCP/运行入口共享中立校验；保留行为 fixtures |
| 中 | core Validator / React useValidator / runtime Ajv 检查真实业务值，不能随页面 DSL 全删 | 保留错误归属/翻译与业务验证；Ajv 作为可选子路径，默认页面不负担该依赖 |
| 中 | MCP generate_page/manifest 主要包装旧节点；fix_document 猜必填值；preview 另行解释 bind/when 树 | 工具 8→3，仅保留 get_catalog、describe_component、validate_document；提示并入诊断，真实预览复用 playground |
| 中 | 上游 @json-render/mcp 提供 MCP Apps 展示，不是本项目作者工具的同义替代品 | 保留可选 lumi-mcp，不为当前作者场景增加 iframe/HTML 打包应用 |
| 中 | code-style skill 与根规则重复且无 frontmatter；.ai 两份规则继续复制架构；Lumi skill 的 UI 提示仍写旧 Schema | 删除重复 skill，保留 .ai 入口指引；Lumi skill 只描述项目增量并更新 metadata；原文另行归档 |
| 中 | create-lumi 仅有一个 adapter 选项，仍维护 RendererAdapter 与分支 | 计划删除 --adapter/类型/模板变量，保留 React 脚手架，不默认安装作者工具 |
| 中 | 视觉正文仍有 Header 禁止主题/账户、表格必须 Frame、表头禁止底色、JSON 无 slots 等冲突规则 | 将当前接受的视觉要求直接并入正文，删除冲突规则与旧图表注册要求，不继续靠补充段覆盖 |

## 源码与文档依据

- 本地 [业务 Validator](../packages/core/src/validation.ts)、[React useValidator](../packages/react/src/validator.ts)、[Ajv 实现](../packages/runtime/src/validation.ts)。这些是迁移来源，不是最终目标 API。
- 本地 [checker JS 入口](../packages/check/src/index.js)、[CLI](../packages/check/bin/lumi-check.mjs)、[构建脚本](../packages/check/scripts/build.mjs)、[MCP 实现](../packages/mcp/src/index.ts)、[create CLI](../packages/create/src/index.ts)。旧 checker 在缺 Rust/WASM 工具时跳过构建的方式不能保留为新验收成功。
- [上游表单校验文档](https://json-render.dev/docs/validation)、[同步字段校验源码](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/core/src/validation.ts)、[动作执行源码](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/core/src/actions.ts)。
- [上游 Spec 检查](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/core/src/spec-validator.ts)、[MCP Apps README](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/mcp/README.md)。源码核对固定于该 commit；npm 发布版本及组合兼容性仍由 P1 验证。

## 本轮实际修改范围

修改计划、规则、Lumi skill/metadata 和视觉规范，删除重复 code-style skill。未修改产品包、依赖或 MCP/checker 实现；它们的删改已列入计划。复审前的相关文档逐字节保存于 [作者工具归档](./archive/author-tool-review-2026-09-19/README.md)，原始旧方案仍在 [旧方案归档](./archive/pre-json-render-2026-09-19/README.md)。

验证范围为 Markdown 本地链接、JSON 示例语法、归档哈希、skill/frontmatter/metadata、包处置覆盖与 whitespace。产品代码未改，本轮不运行产品测试；P1 原生互操作和 P2 数据/提交行为仍是迁移前置验收。
