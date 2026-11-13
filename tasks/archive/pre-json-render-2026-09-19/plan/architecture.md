# Lumi 非视觉页面能力架构

Status: confirmed
Last updated: 2026-08-11
Scope: 页面设计稿 02 的七项非视觉协议、数据、表单、路由与格式化能力
Confirmation: 用户于 2026-08-10 明确交接七项并授权按交接稿实施；随后确认表格三层职责以架构清晰为准
Document language: 中文

## Assessment

### Facts

- 当前标准目录为 25 个 core + 4 个 extension；四项协议增量已进入 descriptor、TS catalog、Rust/native/WASM checker、React/Vue 转发和 docs 生成链。
- `Table` 是 `RendererContract` 的纯受控 UI；`useTable` 组合 `useList` 与 aggregate query；页面容器把 hook 结果交给 `LumiDataGrid`，`LumiListPage` 再统一编排筛选、toolbar 和页面状态。
- React/Vue `useForm` 已提供分组错误、字段子集校验、草稿和 target/pending 竞态保护；overlay controller 与 routed drawer 共用异步关闭 guard。
- `I18nProvider` 已显式声明货币、金额单位、显示时区和严格 ISO-8601 UTC 输入语义。
- Context7 已按仓库要求尝试，服务返回 monthly quota exceeded；实现只依据锁定依赖的本地类型和现有测试，不新增依赖。

### Assumptions

- API 金额默认按主货币单位传输，时间按带时区的 ISO-8601 UTC 字符串传输；通过显式 provider 配置覆盖，测试验证不做隐式猜测。
- `RichText` 与 `DescriptionList` 是新的 core 标准组件；视觉侧负责唯一 adapter 的具体 wrapper 与样式，本范围只建立中立契约、校验、框架转发和测试边界。
- 表单字段组由 `useForm` 调用方显式声明；中立 hook 返回错误路径，不查询 DOM，不猜具体控件结构。

### Open questions

- 无架构阻塞；adapter wrapper 的视觉实现由用户划定的视觉工作流负责，必须在最终全仓门禁前合入。

## Requirements

| ID | Outcome or constraint | Priority | Acceptance | Status |
| --- | --- | --- | --- | --- |
| REQ-201 | Schema 支持 `Fragment.layout/asideWidth`、`RichText`、`DescriptionList`、`Table.totals`，并进入 TS/Rust/WASM/catalog/docs 单源链 | must | AC-201 | implemented |
| REQ-202 | 同一筛选快照驱动列表与统计聚合，统计只在对应列表快照可用时对外暴露，并随 resource 共同失效 | must | AC-202 | implemented |
| REQ-203 | `useForm` 对等提供字段组错误、首错字段路径与字段子集校验，最终提交仍全量校验 | must | AC-203 | implemented |
| REQ-204 | `useForm` 对等提供显式草稿保存、恢复、清除，并保持 target/reset/pending/dirty 并发语义 | must | AC-204 | implemented |
| REQ-205 | routed drawer 使用 `?drawer=`，支持直达、分享、后退关闭；modal 不写路由 | must | AC-205 | implemented |
| REQ-206 | dirty guard 自动覆盖 modal/drawer 的所有 dismiss 路径，单次关闭只确认一次 | must | AC-206 | implemented |
| REQ-207 | i18n 明确提供 locale、currency、currencyUnit、timeZone 与 UTC 输入语义，React/Vue 使用一致 | must | AC-207 | implemented |
| NFR-201 | 保持 `Table` 纯 UI、`useTable` 数据编排、`LumiDataGrid` 受控数据状态 UI、`LumiListPage` 页面编排的单向依赖 | must | AC-208 | implemented |
| NFR-202 | 不修改 adapter 样式、Admin 页面排布、ShellParts、视觉基线及视觉侧展示枚举 | must | AC-209 | implemented |
| NFR-203 | 不新增依赖、不保留兼容层，React/Vue 共享 headless 语义不得漂移 | must | AC-210 | implemented |

## Architecture drivers and risks

| Driver/risk | Linked IDs | Impact | Treatment/evidence |
| --- | --- | --- | --- |
| 协议单源与三端 parity | REQ-201 | 手写一端会产生 TS/Rust/WASM 漂移 | 扩展 descriptor 并重生成 catalog/checker，表驱动路径测试 |
| 列表/统计竞态 | REQ-202 | 新筛选时可能展示旧统计或不同快照 | 共享不可变 filter snapshot/query-key，组合层同步门控 |
| 表单异步提交竞态 | REQ-203, REQ-204 | 旧提交可能污染新 target/baseline | epoch + submission revision；草稿恢复使旧提交失效 |
| URL 与 overlay 双向同步 | REQ-205, REQ-206 | back、dismiss、guard 可循环或重复确认 | URL 为 routed drawer 真源，区分用户 dismiss 与 route sync，guard 串行去重 |
| 金额/时间隐式猜测 | REQ-207 | 显示错误但类型仍通过 | provider 必须暴露显式格式上下文，统一转换 helper 与正负例 |

## Module and data boundaries

| Module | Capability/responsibility | Owns data/invariants | Stable interface | Allowed dependencies | Prohibited responsibilities |
| --- | --- | --- | --- | --- | --- |
| `lumi-schema` | 标准节点和可序列化 props | 25 core + 4 extension 目录、descriptor | `ComponentProps`, catalog | `lumi-core` 类型 | UI 实现、页面组件 |
| `lumi-core` | 数据/i18n/校验纯契约 | query key、格式上下文、表单错误纯函数 | provider/types/helpers | 无框架 | React/Vue/DOM |
| `lumi-react` / `lumi-vue` | headless 查询、表单、overlay | 查询缓存状态、form epoch/draft、overlay stack | hooks/composables | core/schema/query libs | Admin 页面和具体 UI |
| `lumi-admin-react` | Admin 路由与页面行为编排 | routed drawer URL、dirty decision | router hooks/page guards | react/runtime/schema | 适配器样式和基础 Table 实现 |
| `apps/admin-react/mock` | dogfood API 契约 | 筛选列表与聚合结果一致性 | HTTP fixtures | Node | 公共运行时逻辑 |

## Architecture decisions

### ARC-201 — 协议仍由 descriptor 单源生成

- Links: REQ-201, NFR-203
- Decision: 新 core 节点和 props 进入 `props.ts`、`component.ts` 与 `CORE_PROP_VALIDATION`，再生成 TS catalog 和 Rust checker；React/Vue renderer 只做统一 contract 转发。
- Consequences: core contract 从 23 增至 25；不保留旧计数或占位组件。
- Validation: schema author/validator、native/WASM parity、catalog/checker/docs generate checks。

### ARC-202 — 表格采用三层单向组合

- Links: REQ-202, NFR-201
- Decision: `Table` 仅接收 rows/columns/events；`useTable` 组合 `useList` 与可选 aggregate query；页面容器把 hook 结果映射为 `LumiDataGrid` 的受控 props；`LumiListPage` 组合 filters/stats/KPI/toolbar/page content。KPI 独立请求，不进入 aggregate。
- Interfaces/data: aggregate 接收与列表相同的规范化筛选快照，返回 `Record<string, number | string>`；resource 级失效覆盖 list 与 aggregate。
- Validation: React/Vue hook 对等测试、mock 集成测试、边界导入审计。

### ARC-203 — 表单扩展现有 useForm，不把 DOM 放进中立层

- Links: REQ-203, REQ-204
- Decision: `UseFormOptions.groups` 声明字段组；return 暴露 `validate({ fields })`、group errors、首错路径和注入式 draft store。`submit()` 始终全量校验与全量提交。
- Consequences: 页面/adapter 根据首错路径负责实际 focus；草稿恢复后保持 dirty，不改变服务端 baseline。
- Validation: React/Vue 同矩阵覆盖 nested/array path、partial replace、target/reset/restore/pending/latest-submit。

### ARC-204 — routed drawer 以查询参数为真源，overlay guard 为唯一关闭决策入口

- Links: REQ-205, REQ-206
- Decision: Admin routed drawer hook 管理 `drawer` query；overlay controller 支持异步、去重的 close guard 和 route-sync 强制收口。modal 不注册 query。dirty page 向 overlay controller 注册同一个确认函数。
- Failure semantics: 取消确认保持 URL 和 overlay 不变；浏览器后退由 router blocker 拦截；已批准的 route sync 不二次确认。
- Validation: memory router + overlay 集成测试覆盖 direct URL、open/back/dismiss/Esc/遮罩/X 等价路径、取消/确认和重复事件。

### ARC-205 — 格式上下文显式配置

- Links: REQ-207
- Decision: `I18nProvider` 暴露格式上下文；金额单位只允许 `major/minor`，日期输入约定 `iso-utc`，显示时区显式配置；format helper 是 React/Vue 对等入口。
- Validation: core provider、React/Vue hook 对等测试，覆盖 USD/major、CNY/minor、UTC 到目标时区。

## Dependencies and open-source selection

本范围复用现有 React、Vue、React Router、TanStack Query 及 `Intl`，不新增依赖。Context7 查询因配额耗尽未返回内容；锁定版本的本地类型声明和现有测试为实现依据。

## Interaction and failure semantics

- Synchronous paths: 校验、错误分组、草稿 store、格式化均同步且显式失败。
- Query paths: list 与 aggregate 独立取消/重试状态，但组合结果只在同 snapshot 成功后公开；resource invalidation 同时覆盖。
- Overlay paths: close guard promise 去重；guard false/throw 均保持 overlay；route sync 可在已批准后无二次 guard 地移除。
- UI states: 本范围只提供 loading/error/synchronized 数据状态，不修改视觉布局。

## Test strategy

| Scope | Layer | Linked IDs/risk | Required evidence |
| --- | --- | --- | --- |
| 新协议与嵌套 props | contract/native/WASM | REQ-201 | TS/native/WASM 接受拒绝和精确路径一致 |
| list + aggregate snapshot | hook/integration | REQ-202 | React/Vue 同筛选、切换、失效、错误状态 |
| form groups/partial/draft | hook | REQ-203, REQ-204 | React/Vue 同矩阵及竞态回归 |
| routed drawer + guard | integration | REQ-205, REQ-206 | memory router 和真实 controller 的 URL/stack/确认断言 |
| formatting context | unit/hook | REQ-207 | core/React/Vue 固定 locale/currency/timeZone 结果 |
| 完整交付 | root gates | NFR-202, NFR-203 | handoff 列出的 typecheck/lint/test/build/e2e/verify gates |

## Traceability

| REQ/NFR | ARC | Planned TASK | AC |
| --- | --- | --- | --- |
| REQ-201 | ARC-201 | TASK-201 | AC-201 |
| REQ-202, NFR-201 | ARC-202 | TASK-202 | AC-202, AC-208 |
| REQ-203, REQ-204 | ARC-203 | TASK-203 | AC-203, AC-204 |
| REQ-205, REQ-206 | ARC-204 | TASK-204 | AC-205, AC-206 |
| REQ-207 | ARC-205 | TASK-205 | AC-207 |
| NFR-202, NFR-203 | ARC-201..205 | TASK-206 | AC-209, AC-210 |

## Review

| Finding | Severity | Resolution/status |
| --- | --- | --- |
| `Fragment` renderer 特判会丢弃 layout props | P1 | TASK-201 移除丢弃路径，仍由 adapter 决定视觉 |
| core 新组件会要求唯一 adapter 同步注册 | P1 | 明确为视觉协作接口；最终门禁前不得以 cast/placeholder 绕过 |
| headless hook 无法可靠聚焦复合控件 DOM | P1 | 返回首错字段路径；实际 focus 留给页面/adapter 注册层 |
| routed drawer 与 dirty blocker 可能二次确认 | P1 | ARC-204 要求批准 token/route sync 专项回归 |
| `keepPreviousData` 可能短暂公开旧 aggregate | P1 | 组合结果显式拒绝 list/aggregate placeholder data，React/Vue 对等回归 |
| React 同 commit target 变化可能提交新值到旧 target | P1 | render-phase 同步重建并把 target 作为每次 mutation variables 快照 |
| programmatic drawer close 与 direct drawer switch 可绕过/污染 history | P1 | 所有 close 进入同一 scope guard；仅应用内首次 open 写 base state |
| Vue reactive filters/draft 与 overlay 同步 settle 存在生命周期竞态 | P1 | 深度去 Proxy snapshot、稳定 draft control、pending promise identity 清理 |
