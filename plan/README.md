# Lumi / json-render 原生架构方案（React-only）

日期：2026-09-19，最近整理：2026-11-14。视觉方案于 2026-09-21 按用户选择更新为 A 分区卡片，当前要求见 [视觉规范](./ui-design-spec.md)。

状态：当前唯一架构与迁移计划。原生架构迁移已完成，现为五个公开包（2026-11-12 移除 `lumi-mcp`，见 §7.3），代码已同步至实际仓库。持续验收按 §8 的命令与完成条件执行，历史验证不能替代当前结果。

先读本文。架构要求集中在本文，视觉要求集中在 [ui-design-spec.md](./ui-design-spec.md)。旧方案、任务记录与归档快照已移除，不作为开发依据。

## 1. 已确认的架构方向

采用此方向。Lumi 核心直接使用 `@json-render/core`，渲染使用 `@json-render/react`。页面使用上游原生 Spec，Lumi 提供可直接组合的数据、交互、UI 和 Admin 能力。公开 API 的后续变更通过 Changesets 管理语义版本；不建设旧私有页面协议的兼容器。

**2026-11-05 决策：只做 React。** Lumi 是没有历史包袱的新项目，后端将使用 Go，只通过 JSON/HTTP 对接；不再为 `@json-render/vue` 或其他框架预留入口、可选 peer 或隔离门禁。唯一保留的框架无关层是各包的 `/catalog` 子路径（组件/动作 zod 定义与 Spec 校验），因为 `lumi-check` 和服务端校验在 Node 中运行，不应依赖 React。删除自研页面协议和 RendererContract，由上游 Catalog/Registry 承担描述与注册；Admin 直接组合 Lumi UI 的公开 React 组件。

最高优先级的使用原则：会用 json-render 就能直接使用 Lumi。保留 Spec/Catalog/Registry/StateStore/handlers 的名称、结构和使用方式。便捷装配可选，扩展按上游 defineCatalog/defineRegistry 进行；不要求用户先学习 Lumi 私有页面语法、组件注册接口或动作语言。

不改造、不 fork 上游 Renderer。旧字段、作用域和动作执行器不作为保留目标；用户可见功能需逐项保留、重做并验收。

## 2. 对外三层

| 包 | 职责 | 依赖方向 |
| --- | --- | --- |
| `@duxweb/lumi` | 根入口：React Provider/hooks、便捷装配、数据/请求/认证/上传服务与 handlers；`/catalog`：无框架的动作/组件定义与 Spec 加载、校验 | 根入口依赖 json-render core/react、React、TanStack Query；`/catalog` 只依赖 json-render core + zod；不反向依赖 UI/Admin |
| `@duxweb/lumi-ui` | 根入口：shadcn 风格 React UI 与原生 Registry；`/catalog`：无框架组件定义；`/style.css`；按需图表入口 | `/catalog` 不依赖 React；React 实现使用 Radix/TanStack/VChart 等；不依赖 Admin |
| `@duxweb/lumi-admin` | 根入口：bootstrap、登录、Shell、Tab、页面编排、Admin Registry；`/catalog`：路由/菜单/应用配置 schema 与 Admin 页面/动作定义 | 根入口依赖 lumi + lumi-ui；`/catalog` 只依赖其他包的 `/catalog` |

`lumi` 的开箱即用指应用机制已经装配完成。普通 JSON 页面组合 `lumi + lumi-ui`；Admin 使用 `lumi-admin` 的默认装配。基础 lumi 不静态导入 UI 来提供默认皮肤，以免依赖倒置。

UI 公开 React 组件可直接用于 JSX；其 JSON 注册层处理上游 props/bindings/emit/slots。这是上游要求的 Registry 实现，不是 Lumi 旧 Schema 转换器。

目标入口：`@duxweb/lumi`、`@duxweb/lumi/catalog`、`@duxweb/lumi-ui`、`@duxweb/lumi-ui/catalog`、`@duxweb/lumi-ui/style.css`、`@duxweb/lumi-admin`、`@duxweb/lumi-admin/catalog`。`/catalog` 导出可序列化的 definitions；最终 Catalog 由根入口用 `@json-render/react/schema` 组装并可直接导出预组装的 catalog/registry。React 是各包根入口的必需 peer；只有 `/catalog` 需要在未安装 React 时可导入，并由隔离安装测试守护。

Admin 可以直接 import Lumi UI 的 React 公开组件，不导入 internal/Radix/ReUI 原始源码；UI 不承担请求、路由和权限业务。自定义 Shell 继续通过 useShell 编写，不再要求能够替换整套 UI adapter。

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
| 表单校验 | 上游 ValidationProvider 管理原生字段检查；Lumi 提交流程协调业务/异步检查及服务端错误，所有检查读取同一份表单值 |
| Shell 导航、Tab、主题偏好 | Admin Shell 状态 |

每个保留挂载的页面拥有稳定 StateStore，普通 rerender 和 Shell 更新不能重建；不同页面/Tab 隔离。表单值不同时存入旧 useForm 本地状态与 json-render state。保留 useForm 的便利 API 时，内部改用同一个 StateStore。

查询结果需要供 `$state` 读取时，由查询连接组件单向投影到明确的结果路径。该路径由查询组件拥有，不供控件双向编辑；这是 Lumi 的使用约定，上游 StateStore 并不强制路径只读，不为此另造受限 Store。写操作通过 DataProvider 执行，完成后失效查询。查询刷新不能无条件覆盖 dirty 表单，只有首次初始化或明确 reset 才填入表单值。

后端 JSON 驱动数据的能力继续存在：先提供一个普通 Query 连接组件覆盖列表、详情、多条与自定义读取，UI Form 负责表单布局/交互，Lumi hooks 和 submitForm handler 负责数据及提交，Admin ListPage/FormPage 负责页面组合。不同时建立功能重叠的 Query/List/Service 节点，也不让不同包注册两个语义不同的 Form。只有具体场景证明有独立职责时才增加连接组件。它们采用普通原生 Spec 节点，Renderer 不识别特殊 Service/Each/State 节点，也不创建隐式命名作用域。

查询组件订阅明确的筛选、排序、分页路径，变更后更新 query key；不要监听整个 state 并触发请求。绑定写入在 emit 之前完成，使动作参数读取最新值。行操作优先通过原生 repeat 的 `$item`，复杂表格可写入组件专属选中行路径后发事件；不能使用全局共享“最后一个事件载荷”存储。

### 4.1 请求与数据层是 Lumi 的主要增量

json-render core/react 提供 UI state、绑定、watch、动作分发及异步 handler 扩展点；可在 handler 中 fetch。它们不替 Lumi 规定 DataProvider 的列表/详情/CRUD 结果形状、查询键、分页筛选、缓存失效与认证会话。这些数据规范由 Lumi 补齐，沿用上游动作结构调用。

| 能力 | 所有者与落点 |
| --- | --- |
| HTTP 基础、默认 API 地址、凭据、错误归一化、取消 | lumi core 的请求实现；DataProvider 可替换默认传输 |
| getList/getOne/getMany/create/update/deleteOne/deleteMany/custom | lumi core 的 DataProvider；默认 REST provider 开箱即用，不要求每个项目手写 CRUD handlers |
| 分页/排序/筛选、列表 `{ data, total }`、单条 `{ data }` | lumi 的数据契约；JSON 参数与 hooks 使用相同规范 |
| 查询缓存、去重、重试策略、失效、请求竞态 | 框架查询绑定调用同一数据服务；写操作不默认自动重试 |
| JSON 主动查询/提交、结果写入 state | lumi 的原生 action handlers；没有 UI 依赖 |
| 初始加载/依赖变化自动查询 | lumi 的无视觉 Query 注册组件及查询 hooks |
| 表格 rows、输入 value、loading/error 的展示 | lumi-ui 的受控组件；通过上游 state/props 读取 |
| 路由刷新、编辑页/抽屉编排 | lumi-admin 的原生 actions 与页面组件 |
| 多租户（`tenantProvider`） | lumi core 提供者；请求头 `X-Tenant`，切换时同帧重置 `['lumi']` 查询；Admin 侧边栏工作区即租户 |
| 实时推送（`liveProvider`，`liveMode`） | lumi core 的 SSE 实现（fetch 读取，可带请求头）；`resources/{resource}` 事件按事件失效列表和所点名的记录 |
| 乐观/可撤销写入（`mutationMode`） | lumi core `runMutationMode`，hooks 与 JSON update/delete 共用；表单提交始终等待服务端 |
| 权限门控（`CanAccess`） | lumi 注册组件 + `useCan`；结果可写入 state 供其他元素绑定 |
| 列表 URL 同步（`syncWithLocation`） | lumi `useTable` 经 RouterProvider 读写 `page`/`pageSize`/`sort` |
| 导入导出（`exportList`/`importList`，`useExport`/`useImport`） | lumi core 的 CSV/分页拉取/批量创建；保存与选文件由 React 层注入宿主能力 |
| 审计日志（`auditLogProvider`） | 可选提供者；写成功后由 `executeMutation` 记录，导入记一条汇总；Admin `AuditLog` 展示 |
| 浏览器标题 | lumi-admin Shell，`app.documentTitle` 模板与 `useDocumentTitle` |

`resource + dataProviderName` 继续可以直接选择服务，不增加 Resource 对象注册/隐式 CRUD 页面推导。普通 HTTP 请求走 DataProvider.custom/同一传输服务，不在各组件里散写 fetch。框架 UI hooks 与 JSON actions 必须调用同一份业务服务。

查询缓存复用 TanStack Query，同一宿主的 hooks/Query/actions 使用同一个 QueryClient、query-key 和失效规则。中立服务通过无框架的 QueryClient 能力接入；React hooks 仅作订阅绑定，不再自建缓存或把 React Query 导入中立入口。普通一次性 request 与受缓存管理的 Query 分工明确。

### 4.2 JSON 可直接驱动请求

目标支持三种入口：`on` 触发一次性请求，`watch` 触发数据依赖联动，Query 组件负责首次挂载及参数变化后的自动查询。上游 watch 不在初始渲染执行，不能用它冒充首次加载；Query 是普通注册组件，不修改 Spec 结构或 Renderer。

下面是已实现的 Lumi Catalog 示例，不是上游内置 action；原生字段保留，`request` 及其 params 由 Lumi 定义：

```json
{
  "type": "Button",
  "props": { "label": "加载订单" },
  "on": {
    "press": {
      "action": "request",
      "params": {
        "url": "/orders",
        "method": "GET",
        "query": { "status": { "$state": "/filters/status" } },
        "resultPath": "/orders/result"
      }
    }
  },
  "children": []
}
```

执行路径：原生 emit → ActionProvider → Lumi request handler → 配置好的 DataProvider → 显式写入 StateStore → 绑定组件更新。resultPath 约定存规范化结果，不把返回值自动写回当作上游保证；handler 负责写入。完整列表/分页优先使用有缓存管理的 Query/getList，而不是每次点击裸请求后手动维护第二套缓存。

预置 Query 的 Catalog 已声明请求目标、分页/排序/筛选、enabled 和明确的结果路径；投影包含 data/total/loading/error，文档从定义生成。它是该普通组件的业务属性，不是新增顶层 `services`/`scope`/`bind` 语法。

结果投影的生命周期必须固定：同一 `(StateStore, resultPath)` 只能有一个写入者；参数来自独立的输入路径，不能依赖自己投影的 loading/data。卸载、切换记录或会话后，旧响应不得再写入；底层取消共享查询时须考虑其他订阅者。明确切换条件后旧数据的保留/清空规则，以及 disabled、失败和再次加载时的结果形状。Query 的 data/loading/error 投影需要一致更新，不能短暂混用不同查询快照。P2 验证这些行为，不新增全局事件总线。

### 4.3 组件联动与互相操作

| 用户操作 | 实现方式 |
| --- | --- |
| 按钮打开/关闭另一个 Drawer | 原生 setState 更新绑定到 Drawer.open 的 state 路径；路由抽屉由 Admin action 更新 URL |
| 表格选中一行，另一块展示详情 | 选中项写入页面 state；详情读取 ID 并通过 Query 加载 |
| 省份变化重新加载城市选项 | 原生 watch + Lumi 查询 handler，或 Query 订阅省份参数；清空失效的旧城市选中值 |
| 保存表单后刷新列表与统计 | 原生异步 action 调用 Lumi mutation，成功后 invalidate 同一资源查询；失败保留表单值与错误 |
| 一个控件修改另一个控件的值/禁用状态 | setState + 目标控件的原生绑定/条件属性 |
| focus、滚动、导出等必须命令式的操作 | 明确注册、限定参数的 handler；如需 ref，由宿主/对应框架层管理生命周期 |

支持组件互相操作的结果，但 JSON 不访问任意组件实例方法，不建立一个可调用任意 ref 的通用 command 解释器。需要复杂联动时直接注册业务 handler，仍使用原生 action/params。命令式行为不能反向污染框架无关 core。

P2 必须验收：首次自动加载、筛选驱动列表、跨组件选中联动、级联远程选项、保存刷新列表/统计、打开/关闭抽屉。请求晚返回不能覆盖新条件下的数据；watch 写回不能自触发循环。

### 4.4 提交与动作成功条件

原生动作数组表达顺序，不保证业务事务。上游 validateForm 只更新校验结果，不会自动阻止下一条 submit；本次核对的核心校验函数返回同步 boolean，不能把 Promise 直接注册进去就视为已支持异步校验。Lumi 的具名 submitForm handler 必须读取当前表单快照，执行字段/业务校验并等待异步结果，仅在有效且目标/快照仍一致时提交。

- 每个表单有明确的值路径和校验范围，多个表单互不阻塞；分步/折叠/卸载字段的保留、清理和最终全量校验规则必须明确，不能只依赖“当前挂载字段”。
- 同一表单重复提交需要防重入；不同表单/不同记录可独立 pending。上游按动作名称标记 loading 不足以承诺并发隔离，不能据此锁住页面所有按钮。
- 保存成功后才能执行关闭/导航/失效；失败保留值和字段错误。不能无条件使用 `[validateForm, save, close]`，也不能把已被 onError 消化的失败当成保存成功。
- 保存已成功但刷新失败时，应提示刷新重试，不重复提交 mutation。取消请求或离开页面不等于回滚服务器已经完成的写入。
- 纯 UI 字段继续使用原生校验接口。业务校验和服务端字段错误通过同一表单错误展示入口归属，不新建第二份表单值或 Lumi 动作编排语言。

## 5. UI 与 Admin 保留的资产

- 复用现有 shadcn/Radix/ReUI MIT 源码、主题、HugeIcons 和视觉布局。
- 保留 TanStack 表格引擎和 VChart 按需加载，移除仅服务旧中立 adapter 的参数转换。
- UI Table 管理表格交互与展示；数据 hooks 管理服务端查询；Admin DataGrid/ListPage 组合两者。
- 复用 Shell facade、单栏/双栏、自定义 Shell、表单和设置页布局，但改成直接组合公开 React UI。
- 页面 JSX 与 JSON 使用同一套公开 UI 实现；JSON props 只表达可序列化参数。JSX callbacks/ReactNode 不强行进入 Catalog。
- Catalog 中的 JSON 属性表达组件用途、值、选项、样式与事件，不含 ReactNode、VNode 或底层框架对象；不同框架的 JSX/template API 可采用本框架习惯。复用上游原生 Catalog 表达能力，不重建独立中立协议包，也不把整个 ColumnDef/Radix API 暴露给 JSON。

### 5.1 基座模式（免编译，2026-11-06 确认）

业务开发默认不编译。`@duxweb/lumi-admin` 额外产出预构建基座 `dist/base/lumi-admin.js` + `lumi-admin.css`（内含 React、json-render、Lumi、UI、Admin；全量图标与图表引擎为懒加载 chunk），后端或 CDN（如 `cdn.jsdelivr.net/npm/@duxweb/lumi-admin@<版本>/dist/base/`）直接引入。基座不进入包的 import 图，也不加 `exports`。

- **配置**：`adminBaseConfigSchema`（`@duxweb/lumi-admin/catalog`，无框架依赖；`lumi-check --kind config` 与后端可校验）。来源按顺序：`window.LumiAdminConfig`、`<script type="application/json" id="lumi-admin-config">`、基座 script 的 `data-config` URL。根上是 `data`（后端）、`auth`（登录方式）、`access`（权限规则）、`panels`（后台入口），各自可以是一个对象或按 `name` 区分的列表；另有 `theme`、`i18n.translations`、`frameOrigins`、`packKey`、`modules`、`cacheKey`。panel 上有 `manifest`、`pages`、`login`、`menuBadges`、`shellStorageKey` 等。默认由 `data` 生成 `createSimpleDataProvider`，由 `auth` 生成 `createSimpleAuthProvider`（bearer 或 cookie，权限 `resource:action`）。字段说明以文档站「项目配置」为准。
- **回调**：JSON 表达不了的（自定义 provider、`onEvent`、`handlers`、抽屉）放 `window.LumiAdminSetup`（单个或数组，多个脚本各自 push）或基座之后的脚本调用 `LumiAdmin.use(ext)`，挂载前与 modules 按序合并（config modules → LumiAdminSetup → use）。扩展选项是平的：`dataProviders`、`authProviders`、`accessProviders`（按配置里的名字替换）、`i18nProvider`、`tenantProvider`、`liveProvider`、`auditLogProvider`、`toastProvider`、`notificationProvider`、`validator`、`upload`、`agent`、`env`。
- **扩展模块**：配置 `modules: [url]`，基座挂载前 `import()`；模块 `default(runtime)` 返回 `{ components, handlers, drawers, providers, … }`。`runtime`（亦在 `window.LumiAdmin.runtime`）提供 `React`、`jsx`、`lumi`、`ui`、`admin`、`jsonRender`、`z`，扩展用同一份 React 与 Lumi 上下文调用 hooks。组件带 zod props，并入 Catalog 后与内置组件同样校验。Spec 仍只含可序列化值与已注册动作。
- **新增组件**：Lumi 自带组件随基座版本发布，使用方升级 CDN 版本号即可；业务自有组件走扩展模块，无需编译；第三方组件需预构建为使用 `runtime.React` 的 ESM，不得自带 React。
- **编译型宿主**：同一 `mountAdmin(config, extensions)` 供需要打包的宿主使用；`createAdmin` 保持为底层 API。
- **验收**：`examples/base-admin`（纯静态 HTML + JSON + 纯 JS 扩展，Node 静态服务器）与 e2e 项目 `base-admin`。

## 6. packages 逐包处置（11 → 5）

以 2026-09-19 磁盘上实际存在的 11 个 package.json 为准。最终为 3 个产品包 + 2 个工具包；子路径用于框架边界，不再额外发布 core/schema/runtime/react 等实现拆分包。

| 当前目录 / 包 | 最终目录 / 包 | 处置 | 可删除旧目录的阶段 |
| --- | --- | --- | --- |
| `packages/lumi` / `@duxweb/lumi` | 原目录、原包名 | 重建：从 umbrella 改为通用服务 + 原生 json-render 集成，根入口为 React 入口，`/catalog` 为无框架定义与校验 | 保留 |
| `packages/core` / `lumi-core` | 并入 `packages/lumi/src/core` | 迁出 provider、请求、query-key、纯校验与格式化后删除；旧 expression/template 解释器淘汰 | P4 |
| `packages/react` / `lumi-react` | 并入 `packages/lumi/src/react` | 重构 hooks、Provider、上传/表单/数据连接；删除自研 renderer，不整包原样搬入 | P4 |
| `packages/runtime` / `lumi-runtime` | lumi 通用 loader + React bindings；Admin 纯逻辑归 admin | 拆分后删除；旧 action/event/command/value/renderer 执行链淘汰 | P4 |
| `packages/schema` / `lumi-schema` | 所属包的 Catalog/config definitions | 迁出有用配置和组件词汇后删除；删除旧 SchemaNode、RendererContract、scope 和生成链 | P4 |
| `packages/vue` / `lumi-vue` | 当前无替代目录 | 旧 binding 整包删除；不再提供 Vue 实现 | P4，与根配置和工具同步 |
| `packages/ui-shadcn` / `lumi-ui-shadcn` | `packages/ui` / `@duxweb/lumi-ui` | 改目录/包名；保留 UI/主题/上游来源，改原生 Catalog + React Registry | P4 完成切换 |
| `packages/admin-react` / `lumi-admin-react` | `packages/admin` / `@duxweb/lumi-admin` | 改目录/包名；纯配置隔离，React 页面直接组合公开 UI | P4 完成切换 |
| `packages/check` / `lumi-check` | 原目录、原包名、`lumi-check` 命令 | 保留 TS CLI 外壳；P1 接共享校验，内部 Rust/WASM 和旧协议 checker 全部替换 | P4 删除 Rust 工具链 |
| `packages/mcp` / `lumi-mcp` | 无；功能并入 `packages/check` | 2026-11-12 整包删除；查目录、查组件并入 `lumi-check` 的 `catalog`、`describe` 子命令，校验本来就是它 | 已删除 |
| `packages/create` / `create-lumi` | 原目录、原包名 | 保留 CLI；模板改最终 3 层组合，仅生成 React | P4 |

最终目录：

```text
packages/
├── lumi/
│   └── src/
│       ├── index.ts          # React public entry (providers, hooks, services)
│       ├── core/             # Requests, loader, pure logic (framework-free)
│       ├── catalog/          # /catalog: definitions + Spec validation, no React
│       └── react/            # React providers, hooks, native integration
├── ui/
│   └── src/
│       ├── index.ts          # React public entry: UI and registry
│       ├── catalog/          # /catalog: serializable definitions, no React
│       ├── react/            # Public UI and json-render registry
│       ├── internal/         # Owned React shadcn/ReUI implementation
│       └── style.css         # Single theme/CSS source
├── admin/
│   └── src/
│       ├── index.ts          # React public entry: shell, routes, pages
│       ├── core/             # Pure menu and route calculations
│       ├── catalog/          # /catalog: app/menu/route schema + definitions, no React
│       └── react/            # Shell, routes, pages, registry, styles
├── check/                    # TypeScript CLI: catalog lookup, component description, validation
└── create/                   # React scaffolding
```

这里是目标树。物理构建不得让 `/catalog` entry 或其类型声明间接导入 React、DOM 或具体 UI；不能只靠目录命名声称隔离。

### 6.1 文件/能力迁移去向

| 现有来源 | 新位置/处理 |
| --- | --- |
| core `providers/*`、`data/*`、`query.ts`、`types.ts` | lumi core：provider 契约、纯查询键和数据服务 |
| core `context.ts` | 拆纯服务装配与 React Context；分别 lumi core/react，不保留双套 create API |
| core `form.ts`、`validation.ts` | 迁纯错误归属/格式化；规则执行复用统一表单校验入口，删除旧协议专用校验分支 |
| core `path.ts` | 逐函数审计；业务字段路径需要的留在 core，原生状态路径操作直接用上游 JSON Pointer，不能转换整套旧表达式 |
| core `expression.ts`、`template.ts` | 随所有旧表达式消费者改写后删除 |
| runtime `index.ts` loader、`headers.ts` | lumi core loader：保留取消、ETag、缓存隔离、超时与凭据来源控制；改为原生 Spec 校验 |
| runtime `admin.ts` | admin core：路由展平、显式菜单与访问过滤 |
| runtime `theme.ts` / schema `theme.ts` | 主题配置与纯投影归 UI 中立目录；DOM/系统主题监听归 UI React |
| runtime `upload.ts` / schema 上传相关配置 | 传输与校验归 lumi core，hooks 归 lumi `src/react`，视觉归 UI React |
| runtime `validation.ts` | Ajv 业务校验与错误归一化保留为 lumi 可选无框架子路径；旧页面协议校验删除，见 §7.1 |
| runtime `action.ts/event.ts/command.ts/value.ts/renderer.ts` | 删除旧执行链；业务动作逻辑改原生 handler；focus/refresh 等保留为注册组件能力或业务 handler，不能重建 command DSL |
| runtime `trace.ts` | 删除旧 scope/command trace 模型；有用的诊断接上游观察能力或普通服务日志 |
| react `data/query/invalidation/providers/select/table/upload/subscribe` | lumi `src/react` 重构；纯 helper 下沉 core，React Query hooks 不进入根入口 |
| react `form.ts`、`validator.ts` | 单 StateStore 表单值；保留草稿/dirty/分步/分组错误和竞态保护，移除重复表单值存储 |
| react `overlay.tsx` | 无视觉 overlay 生命周期/guard 归 lumi `src/react`；Dialog/Drawer DOM 归 UI，路由联动归 Admin |
| react `context.tsx`、`LumiRuntime/LumiRender/LumiSchemaPage` | 收敛为原生 Provider/Renderer 的可选装配，保留 spec/registry/handlers/store；不得再解释旧树 |
| react `LumiService/LumiState/LumiFilter/LumiForm/LumiRemoteField/LumiUploadField` | 删除特殊节点处理。必要的数据/表单连接组件按原生 Catalog 注册；纯字段外观归 UI，请求执行归 lumi `src/react` |
| react `action.tsx`、`useRenderer.ts`、`renderer/createReactRenderer.tsx` | 业务动作迁 handler；自研渲染器和事件转发入口删除 |
| schema `props/component/prop-descriptor/generated/catalog/default-text` | 按组件拆进 UI/Admin/Lumi 原生 Catalog；文档与类型从新定义获得，删除旧描述器生成器 |
| schema `node/runtime-node/scope/dynamic/action/event/contract/define/document/validate` | 旧协议删除；必要的动作参数/应用文档定义按所属层新建原生 definitions，不保留旧结构 |
| schema `filter/chart/field/text/security/service/types` | 逐项拆：图表/展示词汇归 UI Catalog；数据服务/翻译/上传安全归 lumi；Admin 配置归 admin；过滤/表单模型按实际所有者保留纯定义 |
| ui-shadcn `internal/*`、CSS、icons、charts | 复用公开许可源码和视觉资产；调整目录/import/元数据；图表按需加载与大小预算继续保留 |
| ui-shadcn `components/*`、`contract.ts` | 组件可用实现改公开 React API；contract.ts 替换为上游 Registry；JSON 控件使用上游 bindings/emit/slots |
| admin-react `pages/contract.ts` | 删除 RendererContract helper；页面改直接使用 UI React exports |
| admin-react `menu/routeMatch/types` | 纯配置/算法放 admin core，含 ReactNode 的类型放 admin/react |
| admin-react `createAdmin/router/routedDrawer/colorMode/components/pages` | 保留业务结果，重接原生 Spec；通用主题状态归 UI，Shell 只消费主题上下文 |
| check `Cargo.toml/Cargo.lock/src/*.rs`、WASM JS/d.ts、build/generate-protocol/prepare-package 脚本 | TS CLI 验收通过后删除；fixtures 按原生 Spec 重写；旧 Rust 输出/构建目录不进入包 |
| MCP `src/index.ts` 内旧 node/schema Zod 定义 | 删除重复协议，工具改消费装配 Catalog；拆工具职责，保留与新行为一致的测试 |

迁移时测试按“用户行为”搬迁：保留缓存隔离、竞态、表单、路由、上传和视觉回归；只验证旧语法的测试随语法淘汰。每个旧目录删除前，必须记录能力目标、通过的针对性测试和消费者已迁完的证据。

## 7. 校验与作者工具

组件可序列化 props、事件、slots、动作参数的定义与实现归属同一个包。最终应用组合 Catalog，并由同一份定义生成作者提示、文档、CLI 检查；不并行维护手写 TS 属性目录与 Rust 字段清单。

### 7.1 校验器逐项处置

| 当前能力 | 决定与新归属 |
| --- | --- |
| schema 的旧 SchemaNode/表达式/RendererContract 校验 | 删除；使用上游 Catalog/schema 和 core validateSpec，不再维护协议解析器 |
| 原生 Spec 入站检查 | lumi 中立校验入口接受宿主组装的 Catalog；复用上游校验，补齐经测试确认缺少的严格检查与诊断；CLI/loader/playground 共用 |
| core Validator、ValidationIssue、formatIssues、React useValidator | 保留业务规则执行、字段归属、翻译和 hook 的价值，按同一 StateStore 和可等待的提交接口重构；不承诺旧 API 兼容 |
| runtime 的 Ajv JSON Schema 业务校验 | 保留为可选的 `lumi/validation-json-schema` 能力，支持实际后端业务规则；默认原生页面不强制安装/加载 Ajv，也不为相同规则同时手写 Zod 与 JSON Schema |
| 上游字段校验 | 直接使用 ValidationProvider/checks；它不替代异步业务检查、服务端字段错误、分步/跨字段提交规则，见 §4.4 |
| Admin manifest / theme 配置校验 | 分别归 admin/UI 的中立定义；不是页面 DSL，不因删除 schema 包而丢失 |
| lumi-check TS CLI | 保留独立工具包和命令；只负责文件/stdin、Catalog 加载、诊断输出与退出码，不再拥有校验引擎 |
| Rust / WASM / protocol descriptors / TS-Rust-WASM parity | 删除实现和构建链；原有有价值的行为 fixtures 改为原生格式，由共享校验执行一次 |

页面和业务数据是两类输入：Catalog 检查 Button、Query、action 参数等页面定义；业务 Validator 检查用户填写的订单/客户数据。两者不能因为都叫“校验器”而合并或全部删除。纯 UI 用户无需配置 Lumi Validator；选择 JSON Schema 业务规则的用户才启用可选实现。旧 Ajv 对旧页面 DSL 的依赖不能随业务能力一起搬入。

### 7.2 校验边界与 Catalog 装配

保留严格入站检查：允许的组件/动作/事件/slots、属性和参数、节点引用、应用加载边界等。上游 Renderer 对部分缺失组件/handler 只警告，不能把“渲染未崩溃”当校验通过。宿主的自定义组件和 handler 必须参与最终 Catalog 与注册检查；仅检查内置目录会误报业务扩展。

- 定义使用上游 defineCatalog/defineRegistry 组合；保留 definitions 与原生 catalog 的区别。平台 schema 由对应平台入口提供，检查器不默认导入 React Registry、UI DOM 或 Admin 页面。
- 静态检查使用支持上游表达式的 Spec schema；`{ "$state": "/name" }` 不能按已解析的 string prop 直接报错。数据尚未加载时也不能因为路径暂时缺值而判整个文档非法。Lumi handler 在执行边界对解析后的参数再检查，不执行未知操作。
- 验证原生 repeat/slots 的引用和图结构；循环引用、文档大小等上游未覆盖的加载边界才做小范围补充，不重写表达式求值或完整树解释器。
- 未配置的业务校验器不能静默放行。已知的 validator 名称来自宿主配置；Node 检查器不执行异步业务规则、请求或 UI。
- 统一结构化诊断至少包含 code、path、message、hint、severity，保留上游错误来源。错误阻止接收，警告与错误区分；path 对应原生文档位置。
- CLI 接受宿主明确配置的本地 Catalog 模块；它只导出定义，不导入组件实现。CLI 提供 `--catalog` 替代旧 `--contract`；无自定义配置时使用工具明确标注的默认目录。JSON 内容不能指定并执行任意模块。
- CLI 保留文件输入/`--json`，补 stdin；退出码 0=通过、1=文档不合法、2=文件/配置/运行错误。Spec 与 Admin/theme 配置显式区分，不用旧 protocolVersion 做识别。

Catalog/schema JSON 与 llms 资料是从定义生成的静态作者产物，不引入第三份手写协议或新的 schema 发布服务。配置文件/产物的加载方式在 P1 用真实打包测试固定，不能等 P4 才发现工具需要加载浏览器。

流式临时 Spec 允许未完成状态，最终文档必须通过完整检查。流式生成期间不自动执行写数据动作；正式交互仍由已注册 handlers 和服务端权限保证。Manifest 只负责 app/routes/menu，路由内容引用原生 Spec，不再包裹旧页面 DSL。

### 7.3 作者工具：只保留 lumi-check，MCP 已移除

下表是 P1 时对旧 8 个 MCP 工具的处置记录；保留的三项现在都由 `lumi-check` 提供。

| 现有工具 | 决定 |
| --- | --- |
| get_catalog | 保留；读取最终 Catalog，支持组件/动作筛选与摘要，不每次返回整库 |
| describe_component | 保留；从同一定义返回 props、events、slots、必要示例；动作详情可由 get_catalog 按名称读取 |
| validate_document | 保留；调用共享校验，返回包含修复提示的结构化诊断；覆盖原生 Spec 及显式选择的 Admin/theme 配置 |
| generate_page / generate_manifest | 删除；现有实现主要是包裹旧节点/清单，原生 Catalog 的 schema/prompt 与经过校验的示例已能支持生成 |
| explain_errors | 合并到 validate_document 返回值，避免为解释一次错误多调一个工具 |
| fix_document | 删除；旧实现猜测必填字段值，可能改变意图。首版不提供自动改写；将来采用上游 autoFixSpec 也必须显式选择、展示 diff 后重新校验 |
| preview | 删除旧的模拟树解释器；真实预览复用 playground 的原生 Renderer，不在 MCP 中再造 HTML/布局执行链 |

**2026-11-12 决策：删除 `lumi-mcp`。** 上表保留下来的三个工具里，校验本来就是调用 `lumi-check`，另外两个（查目录、查组件）已并入 `lumi-check` 的 `catalog` 和 `describe` 子命令，输出与原工具相同。命令行在所有 AI 工具里都能直接运行，不需要配置服务器，也少发一个包、少一个 MCP SDK 依赖。不要再加回 MCP 服务器。上游 `@json-render/mcp` 用于在 MCP 客户端中展示交互式 Apps，与作者查询无关；未来确有“在聊天中运行 Lumi 页面”的需求时，再单独接上游能力。

### 7.4 Skills、规则与脚手架

| 资产 | 决定 |
| --- | --- |
| 根 AGENTS.md | 保留仓库约束；计划进度与逐包迁移以本文为准 |
| .ai/AGENTS.md、.ai/rules/lumi.md | 保留工具入口，缩为根规则/计划的指引，避免三份独立架构规则漂移 |
| .claude/skills/lumi/SKILL.md 与 agents/openai.yaml | 保留一个 Lumi skill；仅说明 Lumi 服务/目录/业务行为和工具流程，更新旧 Schema 提示，不复制上游教程 |
| .claude/skills/code-style/SKILL.md | 删除重复 skill；通用风格已在根规则，其 CLI 依赖例外并入根规则；按改动运行必要检查，最终迁移再跑全门禁 |
| json-render 上游 skills | 按需使用与锁定版本对应的 core/react 指南，不复制一套进 Lumi；shadcn 指南涉及上游组件包时不能直接当成 Lumi UI 文档 |
| docs Catalog/API/llms 与示例 | 保留一套生成链，来源是实际 definitions/exports/已验证示例；删除旧 scope/command/descriptor 文档，不保留第二套手写能力目录 |
| create-lumi | 保留；只生成 React 和最终入口，删除仅一个选项的 `--adapter`/RendererAdapter 及旧替换变量；不强制安装 skills，不写用户全局配置 |

作者流程收敛为：读取 Catalog/示例 → 生成原生 Spec → 共享校验并按诊断修正 → 真实 Renderer 预览。AI 和 CLI 均不成为生产渲染前置依赖。当前没有增加 schema 包、validator 包、skill 包或独立生成服务的必要。

## 8. 执行阶段、依赖与删除闸门

| 阶段 | 工作与依赖 | 阶段完成标准 | 当前状态 |
| --- | --- | --- | --- |
| P0 计划收敛 | 收敛 plan，确定包/入口/消费者/规则，保留业务和视觉要求 | 唯一计划；5 个公开包；旧文件处置与迁移顺序明确 | 已完成 |
| P1 原生基础与作者闭环 | 验证上游发布物与版本，lumi core/react、基本 UI definitions/Registry；最小共享校验 + CLI + 自定义 Catalog；依赖 P0 | 原生 Provider/Renderer + Lumi UI 独立可运行；便捷装配等价；中立/Node 工具与打包入口隔离；原生表达式不误报 | 已完成 |
| P2 业务纵向链路 | 列表筛选/分页 → 编辑抽屉 → 校验 → 保存 → 关闭 → 刷新；依赖 P1 | 单 StateStore；异步校验拦截、分步/双表单、错误/重复提交/dirty/投影竞态、查询取消与页面隔离通过 | 已完成 |
| P3 产品迁移 | 全组件、Shell/所有页面、图表/上传/远程选项；依赖 P2 | JSX/JSON 公用组件，功能与视觉回归，所有页面有目标实现 | 已完成 |
| P4 原子收口 | 全部应用/JSON/工具/文档/脚手架/构建/发布配置切换；依赖 P3 | 旧 5 个独立包删除、UI/Admin 改名、Rust 删除；最终 5 包，无旧运行链 | 已完成 |
| P5 最终验收 | 全量质量、隔离安装、生成物、体积、浏览器和发布门禁；依赖 P4 | 下述完成定义全部满足；提交可审查的真实结果 | 已完成 |

迁移代码在隔离工作区/迁移分支完成；当前工作区已有大量未提交和未跟踪实现，不能从 Git HEAD 新开 worktree 后假定它包含当前产品。建立工作区时必须基于完整当前文件快照，并保留用户改动。不要 reset/clean/覆盖未提交实现。

P1–P3 可在迁移工作区临时保留旧代码作为移植来源，但不增加兼容 adapter，不发布两套入口；P4 一次性完成消费者切换和旧路径删除。未完成 P2 不批量删除数据/表单能力；未完成 P4 不标记 Vue/旧包已移除。

P1 必须先固定可安装的上游版本组合、React/Zod/Query peer 范围，并用实际 tarball 验证中立导入、React 宿主和 Node Catalog 检查。P1 就接通一个示例的生成/校验/渲染；P4 扩展到全部消费者，不把工具兼容性留到最后。纯入口可在服务端导入不等于已支持完整 SSR/RSC，本轮不额外扩展 Next/多框架产品范围。

### 8.1 消费者和仓库配置清单

| 位置 | 明确处理 |
| --- | --- |
| `apps/admin`（原 `apps/admin-react`，2026-11-06 改名） | 保留 mock 和预览用途；imports 改最终入口，JSON 数据源改原生 Spec，页面组合走 admin/react；按 §5.1 逐步改为基座模式（菜单、i18n、页面走 JSON） |
| `apps/site` | 官网（Astro）：首页、文档、Playground、`/demo/` 浏览器内完整后台；文档内容由 `apps/docs` 迁入，组件/动作/API 参考由 Catalog 生成为 Markdown，不手工改生成物；`apps/docs` 与 `apps/playground` 已并入并删除 |
| `apps/json-api` | 保留远程 JSON 下发演示；响应、fixtures、测试改原生 Spec 和新的 Admin 配置 |
| `examples/react-demo` | 保留最小原生 Provider/Renderer + Lumi UI 的互操作示例，并展示可选便捷入口 |
| `examples/foundation-admin` | 保留后端 JSON + Admin 场景；重写 manifest/pages/自定义组件注册和部署说明 |
| `examples/schema-gallery` | 保留私有 fixture 包作为共享示例源，内容全部改原生 Spec；不作为公开发布包 |
| `packages/create/src/index.ts` 与 `templates/react` | 删除单选 `--adapter`/RendererAdapter；生成最终包/子路径/CSS imports；验证目录外安装运行；不再包含旧 schema/adapter/资源注册 API |
| 根 `package.json` / `pnpm-workspace.yaml` / lockfile | 添加锁定 json-render 依赖；验证 Zod 版本与上游匹配；移除旧 workspace 依赖、Vue 专用包和 Rust 工具链；不借机升级无关依赖 |
| Vue 专用直接依赖 | 移除 vue/vue-router/vue-tsc/vue3-sfc-loader、@tanstack/vue-query、@vitejs/plugin-vue、@vitejs/plugin-vue-jsx；第三方工具间接依赖按真实需要保留 |
| `vitest.config.ts`、`test/setup.ts` | 删除 Vue 插件/别名、旧包 alias；按真实 exports 验证 core/React，不能靠源码 alias 掩盖坏产物 |
| `config/tsconfig.base.json`、各 tsconfig、tsdown configs | 新子路径与类型产物对应；产品包根入口组装 React，`/catalog` 保持框架无关；移除旧 framework alias/编译路径 |
| `eslint.config.mjs` | 移除 Vue 规则；改导入边界规则为中立入口禁止 React、UI 禁止 Admin、业务依赖按产品层单向 |
| `scripts/generate-docs.ts`、`gen-llms.ts`、`build-doc-products.mjs` | 删除旧 protocolCatalog 和 React/Vue parity 假设，按最终 Catalog/exports 生成文档 |
| 文档 Schema/TS 示例检查脚本、generated-output-inventory | 改检查原生 Spec 和新入口，删除旧命令/作用域/节点文档的生成清单 |
| `verify-package-tarballs.mjs`、`verify-size-budgets.mjs`、`config/lumi-size-budgets.json` | 审计最终 5 包与各子路径；按普通 UI、数据页面、Admin、按需图表的实际加载图比较，合包不机械相加旧单包预算，也不借拆 chunk/放宽预算规避检查 |
| `smoke-ui-shadcn-pack.mjs` | 改为 `smoke-ui-pack.mjs`，同步根 script 与调用者；检查 UI/CSS/原生 Registry 的仓外使用 |
| `verify-ui-upstream.mjs`、`compare-ui-upstream.mjs`、`ui-license-policy.mjs` | 更新 packages/ui 路径，保留许可/来源/Pro 禁入检查；移动未修改的上游源码不得无故重写哈希 |
| `verify-visual-assets.mjs` / `config/lumi-visual-assets.json` | 保留 Lumi 自产截图，更新真实路径；架构迁移不默认重置所有基线 |
| `playwright*.config.*` / `e2e/*` | 更新导入和服务构建入口，保留 Admin 核心行为、主题、响应式、a11y、部署 base 路径测试 |
| `.changeset/config.json` / `.github/workflows/*` / `verify-release-guard.mjs` | 按最终包/命令更新 release/isolation；发布仍交给 Changesets；Pages 继续指向实际 demo，不把包改名误当应用改名 |
| `AGENTS.md` / `.ai/*` / `.claude/skills/*` | 按 §7.4 收敛一个仓库规则源和一个 Lumi skill；同步 agents/openai.yaml，不继续要求维护 Vue、RendererContract 或旧 Rust 协议 |

### 8.2 保留的业务行为清单

- 同一筛选快照驱动列表和聚合；不能混用旧统计和新列表；失效同时覆盖相关查询。
- Tab 分组错误、分步校验、最终全量校验、草稿保存/恢复/清除、dirty、target/reset/submit 竞态保护。
- Drawer URL 直达/分享/浏览器后退；页面离开、Esc/遮罩/X/程序关闭共用去重 guard，取消保持数据和 URL。
- 明确 locale/currency/major-minor/timeZone；不猜金额单位，不混淆 UTC 输入和显示时区。
- 登录/登出成功清理旧身份查询，失败保持原会话，宿主无关查询不受影响。
- 上传进度/取消/失败恢复、远程选项/级联选择、分页/排序/选择/列显隐、图表生命周期。
- single/dual/custom Shell、菜单/Tab/主题/移动焦点、storage 隔离、Shell 更新不 remount 页面。
- 远程文档缓存/ETag/取消/超时/来源控制；错误必须可定位和恢复。

### 8.3 最终命令与完成定义

保留用户熟悉的 `pnpm typecheck / lint / test / build / check:schema / e2e`。`check:schema` 改为原生 Spec + Catalog 的 TS CLI 验证；`verify:generated`、`verify:pack`、`verify:size`、`verify:isolation`、`verify:docs-base`、`verify:release` 按最终结构实现。命令名保留不代表继续运行旧 checker。

CI 将 Lint/来源与生成物、类型、单测、构建与包检查分为独立并行任务；完整 E2E 按 Admin 与其余应用分组，覆盖全部项目。PR 和 main 直接运行共享 CI，日常推送不发布包。版本由 `pnpm run version`（Changesets）准备并提交到 main；推送 `v0.1.0` 这样的正式版本标签后，Publish 复用完整 CI，并检查五包版本一致、无待消费 changeset、标签提交属于 main，再由 Changesets 发布 npm 包并生成同名 GitHub Release。发布步骤不重复执行验证。Pages 独立构建并发布官网、文档、Playground 和浏览器演示。Linux 截图基线与 E2E 使用同一固定 Playwright 镜像，常规 CI 只比较已提交的基线；更新通过手动工作流生成并检查后提交。

完成条件：

1. packages 只有表中的 5 个公开包，每个目标入口和 CSS/按需入口在实际 tarball 中可用。
2. 旧 core/schema/runtime/react/vue 包、旧 UI/Admin 包名及旧 DSL 在活跃源码、配置、模板、文档和发布物中零引用。
3. 当前产品无 Vue 专用源码/测试/入口/直接依赖；各包 `/catalog` 入口无 React/DOM 导入，并在未安装 React 时可导入。
4. 原生 json-render 示例直接换用 Lumi registry 能运行；原生扩展方式有效；便捷装配不改变上游 state/action 行为。
5. 同一 Catalog definitions 驱动运行时、CLI、文档，检查未知组件/动作/属性和无效引用；不再有 Rust/WASM 协议副本。
6. 所有业务行为完成回归；远程生成、表单、数据和 Shell 状态不重复拥有同一份可编辑值。
7. 全量检查、E2E、a11y、视觉、非根部署、5 包隔离安装及模板 smoke 通过，真实体积在既定目标内。
8. 文档与实际能力一致，移除所有迁移占位、临时旧路径与测试豁免；没有靠 fallback 保留旧协议。
9. 内置与自定义 Catalog 在运行时和 CLI 对同一 fixtures 返回一致结果；异步校验失败零提交、保存失败不关闭、保存成功但刷新失败不重复写入；不再依赖旧 MCP 修复/模拟预览。

## 9. 收益与限制

收益是减少自研页面协议、表达式执行器、旧双框架渲染绑定、协议生成链和跨 UI 抽象的维护，直接使用上游交互与生成生态。只交付 React；框架无关层只保留 `/catalog`。不是把所有业务复杂度交给 json-render。

一次性改动大，集中在状态、表单、数据连接、所有 JSON 生产者和作者工具；UI 视觉资产、数据 provider、表格/图表引擎和 Shell 逻辑具有较高复用价值。

不能在完成纵向链路前保证工期、包体积或性能收益。锁定版本并验证安装产物；本次源码核对基于上游 commit `3ad381881194e7011ad3ccd6d668033495a06c29`，其 React 包 package.json 标记 `0.21.0`，不将此等同于已经确认的 npm 最新发布版本。

## 10. 文档依据

- [原生 Spec](https://json-render.dev/docs/specs)
- [Catalog](https://json-render.dev/docs/catalog)
- [Registry 与事件](https://json-render.dev/docs/registry)
- [数据绑定和外部 StateStore](https://json-render.dev/docs/data-binding)
- [Watch 与异步联动](https://json-render.dev/docs/watchers)
- [表单校验](https://json-render.dev/docs/validation)
- [本次核对的 React Renderer 源码](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/react/src/renderer.tsx)
- [本次核对的 ActionProvider 源码](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/react/src/contexts/actions.tsx)
- [核心字段校验实现（同步返回值）](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/core/src/validation.ts)
- [上游 Spec 校验](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/core/src/spec-validator.ts)
- [上游 MCP Apps 用途](https://github.com/vercel-labs/json-render/blob/3ad381881194e7011ad3ccd6d668033495a06c29/packages/mcp/README.md)
