# Lumi / json-render 原生架构方案（当前交付 React，预留框架边界）

日期：2026-09-19。

状态：供评估的目标方案；本文件不表示迁移、包重命名或 Vue 删除已经执行。

## 1. 决策建议

建议采用。Lumi 核心直接使用 `@json-render/core`，当前 React 入口使用 `@json-render/react`，未来 Vue 入口使用 `@json-render/vue`。页面使用上游原生 Spec，Lumi 提供可直接组合的数据、交互、UI 和 Admin 能力。当前产品尚未发布，可以直接修改生产者和消费者，不建设旧协议兼容器。

用户后续澄清：当前移除旧 Vue 实现，不意味着核心永久绑定 React；后续需要能够基于上游增加 Vue。保留清晰的框架边界，删除自研页面协议和 RendererContract，由上游 Catalog/Registry 承担描述与注册。Admin 的框架实现可以直接组合相同框架的 Lumi UI 公开组件；框架无关部分不能导入具体框架。

最高优先级的使用原则：会用 json-render 就能直接使用 Lumi。保留 Spec/Catalog/Registry/StateStore/handlers 的名称、结构和使用方式。便捷装配可选，扩展按上游 defineCatalog/defineRegistry 进行；不要求用户先学习 Lumi 私有页面语法、组件注册接口或动作语言。

不改造、不 fork 上游 Renderer。旧字段、作用域和动作执行器不作为保留目标；用户可见功能需逐项保留、重做并验收。

## 2. 对外三层

| 包 | 职责 | 依赖方向 |
| --- | --- | --- |
| `@duxweb/lumi` | 框架无关的 provider 契约、请求服务、通用动作定义/逻辑、Spec 加载与校验；`/react` 入口提供 React hooks、Provider 便捷装配 | 中立入口依赖 json-render core；`/react` 才依赖 json-render/react、React 及查询绑定；不反向依赖 UI/Admin |
| `@duxweb/lumi-ui` | `/catalog` 提供无框架的组件定义；`/react` 提供 shadcn 风格 UI 和原生 Registry；主题/CSS 独立输出 | Catalog 不依赖框架；React 实现使用 React/Radix/TanStack/VChart 等；不依赖 Admin |
| `@duxweb/lumi-admin` | 中立配置包含显式路由/菜单/应用定义；`/react` 实现 bootstrap、登录、Shell、Tab、页面编排、Admin Registry | 中立配置仅依赖中立能力；React 实现依赖 lumi/react + lumi-ui/react |

`lumi` 的开箱即用指应用机制已经装配完成。普通 JSON 页面组合 `lumi + lumi-ui`；Admin 使用 `lumi-admin` 的默认装配。基础 lumi 不静态导入 UI 来提供默认皮肤，以免依赖倒置。

UI 公开 React 组件可直接用于 JSX；其 JSON 注册层处理上游 props/bindings/emit/slots。这是上游要求的 Registry 实现，不是 Lumi 旧 Schema 转换器。

建议入口使用 `lumi/react`、`lumi-ui/catalog`、`lumi-ui/react`、`lumi-ui/style.css`、`lumi-admin/react`。Catalog 子路径导出无框架的组件/动作 definitions；最终 Catalog 使用对应平台的上游 schema 组合，不能在中立目录里硬编码 `@json-render/react/schema`。React 入口可导出预组装的 catalog/registry。Admin 同样按需提供仅含定义的 Catalog 子路径。按需图表入口继续保留。

以后增加 `/vue` 实现入口，不提前创建空模块。框架代码按源码目录、构建入口和类型导出隔离，中立根入口不得 re-export React；框架 peerDependencies 按入口用途设计为可选，并做隔离安装测试，保证只使用中立入口不需要加载或安装 React。若未来框架依赖规模确实需要拆物理包，再保持相同三层职责拆分，不把此事变成当前用户的学习负担。

未来 Vue 复用 provider 契约、纯服务逻辑、Catalog definitions 和主题种子，使用 `@json-render/vue` 的 Renderer/Provider/defineRegistry。Vue hooks、实际 UI、Portal、Shell 等仍需 Vue 实现；不能宣称换 import 即能渲染现有 React UI。同一 Spec 的跨框架复用以两个 Registry 都实现相同组件/动作和绑定语义为前提。

Admin 的 React 入口可以直接 import Lumi UI 的 React 公开组件，不导入 internal/Radix/ReUI 原始源码；UI 不承担请求、路由和权限业务。自定义 Shell 继续通过 useShell 编写，不再要求能够替换整套 UI adapter。

### 2.1 低学习成本与可直接组合

- 用户可以直接使用上游 Renderer 和 Provider，传入 Lumi UI 导出的原生 registry；基础 UI 使用不强制安装 Lumi 的数据/认证上下文。
- Lumi 的便捷 Provider 仅提供默认装配，并接收上游 spec、registry、handlers、store 等对象；不能隐藏这些对象或强制转换格式。
- 导出组件 definitions、Registry 实现和 handler 工厂，用户可以选择部分组件或使用原生 defineRegistry 添加自定义组件。组合时检查命名冲突，禁止静默覆盖。
- 内置 data/auth/upload 组件或动作才要求相应 Lumi 服务配置；纯展示、普通输入和自定义 handler 保持上游用法。
- 核心入门文档只介绍安装、导入预设、渲染原生 Spec。数据 provider 和 Admin 配置按使用场景渐进介绍。
- 验收包含独立宿主使用原生 json-render Provider/Renderer + Lumi UI registry，以及使用便捷装配的等价测试。

## 3. 上游与 Lumi 的边界

直接采用上游：

- `root + elements` 页面结构、children 引用、named slots。
- `$state`、`$bindState`、`$bindItem`、repeat、visible、computed/directives。
- `on` 与 ActionBinding、原生 ActionProvider 和注册的 handlers。
- StateStore、Renderer、流式解析与增量更新能力。
- Catalog/Zod 定义与提示词生成；应用入口补齐严格校验。

Lumi 提供产品能力：

- DataProvider、查询缓存、列表/详情/修改 hooks、上传生命周期。
- 认证会话失效、权限检查、i18n 和格式化。
- 内置 request/create/update/delete/invalidate 等动作 handler。
- 表单提交、草稿、dirty、离开拦截与业务校验的组合。
- 应用路由与远程 Spec 加载；Admin 的菜单、Shell、Tab 和页面。
- 预注册的字段、表格、过滤器、图表和 Admin 页面组件。

动作名称和业务组件名称属于 Lumi Catalog 词汇，可以自定义；不会因此引入另一种页面语法。不要重建旧的 then/else/catch/finally/output 动作语言或通用事件调度 DSL。上游动作组合无法完整表达的事务，由具名异步 handler 承担。

## 4. 状态与数据流

状态按所有权划分：

| 状态 | 唯一所有者 |
| --- | --- |
| 远程查询结果、请求状态和失效 | QueryClient / Lumi 数据 hooks |
| 页面 UI 值、过滤条件、表单值、选中项 | 页面 json-render StateStore |
| 表单校验 | 统一字段规则和校验入口；优先复用上游 ValidationProvider，业务异步校验注册扩展 |
| Shell 导航、Tab、主题偏好 | Admin Shell 状态 |

每个保留挂载的页面拥有稳定 StateStore，普通 rerender 和 Shell 更新不能重建；不同页面/Tab 隔离。表单值不同时存入旧 useForm 本地状态与 json-render state。保留 useForm 的便利 API 时，内部改用同一个 StateStore。

查询结果需要供 `$state` 读取时，由查询连接组件单向投影到明确的只读状态分区；该分区不是第二份可编辑缓存。写操作通过 DataProvider 执行，完成后失效查询。查询刷新不能无条件覆盖 dirty 表单，只有首次初始化或明确 reset 才填入表单值。

后端 JSON 驱动数据的能力继续存在：在 Catalog 中注册普通 Query/List/Form 等连接组件，或 Admin 的 ListPage/FormPage。组件内部使用 Lumi hooks，并把结果输出到显式 state 路径。它们采用普通原生 Spec 节点，Renderer 不识别特殊 Service/Each/State 节点，也不创建隐式命名作用域。

查询组件订阅明确的筛选、排序、分页路径，变更后更新 query key；不要监听整个 state 并触发请求。绑定写入在 emit 之前完成，使动作参数读取最新值。行操作优先通过原生 repeat 的 `$item`，复杂表格可写入组件专属选中行路径后发事件；不能使用全局共享“最后一个事件载荷”存储。

## 5. UI 与 Admin 保留的资产

- 复用现有 shadcn/Radix/ReUI MIT 源码、主题、HugeIcons 和视觉布局。
- 保留 TanStack 表格引擎和 VChart 按需加载，移除仅服务旧中立 adapter 的参数转换。
- UI Table 管理表格交互与展示；数据 hooks 管理服务端查询；Admin DataGrid/ListPage 组合两者。
- 复用 Shell facade、单栏/双栏、自定义 Shell、表单和设置页布局，但改成直接组合公开 React UI。
- 页面 JSX 与 JSON 使用同一套公开 UI 实现；JSON props 只表达可序列化参数。JSX callbacks/ReactNode 不强行进入 Catalog。
- Catalog 中的 JSON 属性表达组件用途、值、选项、样式与事件，不含 ReactNode、VNode 或底层框架对象；不同框架的 JSX/template API 可采用本框架习惯。复用上游原生 Catalog 表达能力，不重建独立中立协议包，也不把整个 ColumnDef/Radix API 暴露给 JSON。

## 6. 包收敛与删除

| 现有包/机制 | 处理 |
| --- | --- |
| lumi-core | 有用的 provider、请求、格式化等并入 lumi 的框架无关目录；删除旧表达式/模板解释器 |
| lumi-react | 数据与业务 hooks 并入 lumi/react，纯逻辑移入中立目录；删除 createReactRenderer 和旧 runtime 节点渲染 |
| lumi-runtime | loader 等有用能力移入 lumi，Admin 逻辑移入 lumi-admin；删除旧值解析、事件/动作 DSL 与命令执行器 |
| lumi-schema | 删除旧页面协议、RendererContract、固定中立目录；组件定义归所属包的 Catalog，应用配置类型归 lumi/admin |
| lumi-ui-shadcn | 改为 lumi-ui，改造 Registry 和公开 React API |
| lumi-admin-react | 改为 lumi-admin/react 实现入口，中立配置隔离；React 实现直接依赖 lumi-ui/react |
| lumi-vue | 删除旧自研 binding，包括源码、测试、文档、构建配置和导出；未来从 json-render/vue 建立新入口 |
| Rust/WASM lumi-check | 删除旧协议实现；保留需要的 CLI 功能时改为 TS，消费同一 Catalog 校验，不维护第二套协议引擎 |
| lumi-mcp / create-lumi | 更新为最终组合 Catalog 和 React-only 模板；不扩展新的解释器 |

Vue 删除覆盖 workspace/catalog、依赖与 lockfile、Vite/Vitest 插件、vue-tsc、TS 配置、发布检查、文档、示例、Playground、技能与 AGENTS 规则。历史 Git 记录不改写；第三方工具的间接依赖按实际需要判断，不能为追求 lockfile 字符串零命中破坏工具依赖。

旧 Schema JSON、旧包名和旧 API 直接迁移，不保留别名或运行时兼容读取。

## 7. 校验与作者工具

组件可序列化 props、事件、slots、动作参数的定义与实现归属同一个包。最终应用组合 Catalog，并由同一份定义生成作者提示、文档、CLI/MCP 检查；不并行维护手写 TS 属性目录与 Rust 字段清单。

保留严格入站检查：Catalog 参数、节点引用、允许的组件/动作、应用加载边界等。上游 Renderer 默认对部分缺失组件/handler 只警告，不能把“渲染未崩溃”当校验通过。

流式临时 Spec 允许未完成状态，最终文档必须通过完整检查。流式生成期间不自动执行写数据动作；正式交互仍由已注册 handlers 和服务端权限保证。Manifest 只负责 app/routes/menu，路由内容引用原生 Spec，不再包裹旧页面 DSL。

## 8. 迁移顺序和验收

1. 更新唯一计划、架构约束与包结构；冻结上游版本，建立现有可见功能与测试清单。
2. 建立 lumi 运行基础、UI Catalog/Registry，跑通输入绑定、点击、原生 Spec、严格校验、页面 StateStore。
3. 完成真实纵向链路：列表加载 → 筛选/分页 → 编辑抽屉 → 校验 → 保存 → 关闭 → 列表刷新，包含错误、重复提交、dirty 和隔离。
4. 改造完整 UI 与 Admin：主题、Shell、所有页面、图表、上传、远程选项、路由和登录会话。
5. 改写全部示例/后端 JSON/文档/工具，物理移除旧包与 Vue；最终只保留一条渲染路径。
6. 完成 typecheck/lint/test/build、原生 Spec 校验、包隔离安装、React-only 脚手架、体积、E2E 和视觉验收。

第 3 步是正式迁移的第一条可验收切片，不是增加长期并存的第二套引擎。切换发布入口时所有消费者必须完成迁移。

专项回归：多 Tab 页面状态隔离；查询刷新不覆盖用户输入；事件读取最新值；校验失败阻止提交；上传取消与错误恢复；登出清理身份数据；Shell 更新不 remount 页面；Schema 页面与 JSX 页面一致；未知组件/动作明确失败。

## 9. 收益与限制

收益是减少自研页面协议、表达式执行器、旧双框架渲染绑定、协议生成链和跨 UI 抽象的维护，直接使用上游交互与生成生态。框架边界保留在代码和入口层；当前只交付 React，未来新增 Vue 实现。不是把所有业务复杂度交给 json-render。

一次性改动大，集中在状态、表单、数据连接、所有 JSON 生产者和作者工具；UI 视觉资产、数据 provider、表格/图表引擎和 Shell 逻辑具有较高复用价值。

不能在完成纵向链路前保证工期、包体积或性能收益。锁定版本并验证安装产物；本次源码核对基于上游 commit `3ad381881194e7011ad3ccd6d668033495a06c29`，其 React 包 package.json 标记 `0.21.0`，不将此等同于已经确认的 npm 最新发布版本。

## 10. 文档依据

- [原生 Spec](https://json-render.dev/docs/specs)
- [Catalog](https://json-render.dev/docs/catalog)
- [Registry 与事件](https://json-render.dev/docs/registry)
- [数据绑定和外部 StateStore](https://json-render.dev/docs/data-binding)
- [表单校验](https://json-render.dev/docs/validation)
- [Vue Renderer 与 React/Vue 差异](https://json-render.dev/docs/api/vue)
- [本次核对的 React Renderer 源码](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/react/src/renderer.tsx)
- [本次核对的 ActionProvider 源码](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/react/src/contexts/actions.tsx)
