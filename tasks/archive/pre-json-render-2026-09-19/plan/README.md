# Lumi 最终架构与开发计划

> 状态：2026-08-10 已确认，后续实现以本文为唯一架构交接基线。
> UI 视觉、Shell 层级与组件状态细则见 [`ui-design-spec.md`](./ui-design-spec.md)。历史方案不再维护，旧 HeroUI、Nuxt UI、Ark UI、Prime UI 路线仅从 Git 历史查询。

## 1. 产品定位与本轮目标

Lumi 是面向企业管理端的 JSON UI 运行时：页面结构、数据绑定、动作、校验、权限和主题均可序列化，由预编译前端基座执行。协议继续保持框架和 UI 库中立，但当前产品交付只以 React Admin 为验收标准。

本轮目标：

1. React 使用 Radix UI 行为基元、shadcn/ui 源码和 ReUI 公共 MIT 源码形成唯一 UI adapter。
2. 删除 HeroUI 和具体 Vue UI/Admin 交付，不保留兼容包、别名或运行时 fallback。
3. 把 Schema 标准组件从“声明很多、适配器勉强兜底”收缩为“每个名称都有完整实现、类型、文档和测试”。
4. 统一主题 Token，让明暗主题、Shell、表单、表格和页面组件只消费语义变量。
5. 用 `LumiAdminShellProvider + useShell` 集中管理菜单、Tab、用户、主题和导航状态，Shell 视觉组件可以替换。
6. 内置原创单栏、双栏两套 Shell；ReUI Pro 页面只允许在官网外部查看，不能下载、提交、打包或用作仓库截图基线。

非目标：

- 本轮不交付 Vue UI adapter、Vue Admin 或 Vue 视觉一致性。
- 不维持现有 134 个组件名的兼容性；删除未完整支持的协议名称。
- 不建设通用 JSON→任意第三方组件参数透传器；Schema 只暴露 Lumi 中立语义。
- 不把 ReUI Pro Block、模板或图标封装进 Lumi。

## 2. 已确认的技术决策

| 领域 | 最终决策 |
| --- | --- |
| React 行为基元 | Radix UI，MIT |
| 基础样式与组件源码 | shadcn/ui Radix + Nova 版本，copy-and-own；颜色和层级由 Lumi Token 覆盖 |
| 高级组件源码 | 只使用 `keenthemes/reui` 公共仓库或免费 registry 中的 MIT Radix 版本 |
| 具体 UI adapter | `@duxweb/lumi-ui-shadcn` |
| Admin 产品层 | `@duxweb/lumi-admin-react` |
| Shell | 原创 `single` / `dual` 两套内置布局，支持自定义 React Shell |
| 状态入口 | `LumiAdminShellProvider` + `useShell()` |
| 样式技术 | Tailwind CSS v4 + shadcn 语义 Token；发布包自带编译 CSS |
| 当前产品支持 | React Admin |
| Vue | 只保留现有 headless binding 作为未来边界；移除具体 Vue UI/Admin 交付 |
| 旧 adapter | 直接删除 HeroUI、Nuxt UI 及其私有词汇，不做兼容层 |
| ReUI Pro | 不进入源码、依赖、示例或发布物 |

选择 Radix 而不是 Ark UI 的原因：shadcn/ui 和 ReUI 都提供可直接复用的 Radix 源码；改用 Ark UI 会要求重写 Dialog、Select、Menu、Popover、焦点和 Portal 行为，失去复用 MIT 源码的主要价值。未来 Vue adapter 可以独立选择 Ark UI Vue，不要求 React/Vue 使用同一底层库。

## 3. 目标分层与包结构

箭头表示“左侧 package 依赖右侧 package”，具体 UI 不得反向进入中立层：

```text
apps/admin-react
  ├──→ @duxweb/lumi-admin-react
  │      ├──→ @duxweb/lumi-react
  │      ├──→ @duxweb/lumi-runtime
  │      └──→ @duxweb/lumi-schema
  └──→ @duxweb/lumi-ui-shadcn
         └──→ @duxweb/lumi-schema

@duxweb/lumi-react
  ├──→ @duxweb/lumi-runtime
  ├──→ @duxweb/lumi-schema
  └──→ @duxweb/lumi-core

@duxweb/lumi-runtime ──→ @duxweb/lumi-schema / @duxweb/lumi-core
@duxweb/lumi-schema  ──→ @duxweb/lumi-core（仅中立类型/能力）

apps/admin-react 在装配根组合 admin-react 与 ui-shadcn；admin-react 只接收
RendererContract，不依赖 ui-shadcn。

@duxweb/lumi-vue                  仅保留 headless binding，不进入本轮 UI 交付
@duxweb/lumi-check                Rust→wasm 协议检查器
@duxweb/lumi-mcp                  AI/MCP 作者工具
@duxweb/create-lumi               React-first 脚手架
@duxweb/lumi                      不绑定具体 UI 的总入口
```

### 3.1 保留与新增

| 路径 | 职责 |
| --- | --- |
| `packages/core` | 零框架核心 |
| `packages/schema` | 唯一中立协议与组件目录 |
| `packages/runtime` | 零框架 JSON 执行 |
| `packages/react` | React headless binding |
| `packages/vue` | 维护现有 headless API，暂不扩展 UI/Admin |
| `packages/ui-shadcn` | 新的唯一 React RendererContract adapter |
| `packages/admin-react` | Shell、认证、路由、Tab 与 Admin 页面组件 |
| `packages/check` / `mcp` / `create` / `lumi` | 检查、作者工具、脚手架和聚合入口 |
| `apps/admin-react` | 唯一 Admin dogfood 与视觉验收应用 |

### 3.2 直接退役

以下路径在替代链路可运行后删除，不保留 re-export、deprecated package 或兼容 alias：

- `packages/ui-hero`：重命名并重建为 `packages/ui-shadcn`，删除全部 HeroUI 依赖和样式桥。
- `packages/ui-nuxt`。
- `packages/admin-vue`。
- `packages/admin-vue-cdn`。
- `apps/admin` 及只服务 Vue Admin 的 mock/脚本；React Admin 仍需的 mock 移入 `apps/admin-react`。
- `apps/theme-studio`、`examples/demo` 及其他只验证 Vue UI 的交付。
- `packages/ui-recipes` 当前 UnoCSS/Ark/Nuxt recipe 实现。第二个具体 adapter 真正开始时，再从已验证的重复事实中提取共享 CSS/recipe；本轮不为未来提前维护第二套样式抽象。

`apps/docs`、`apps/playground`、`examples/react-demo`、create template 和 foundation 示例全部切换到 React + shadcn adapter；无法迁移且没有独立产品价值的示例直接删除。

## 4. UI 源码与许可证策略

shadcn/ui 与 ReUI 的作用是“上游源码”，不是 Lumi 对外 API。

```text
packages/ui-shadcn/src/
├── internal/
│   ├── shadcn/        # CLI 拉取的 Radix 版基础组件，尽量保持上游可比较
│   └── reui/          # 公共 MIT ReUI Radix 源码，禁止 Pro 内容
├── components/        # Lumi 中立 props/event 包装
├── style.css          # 种子→shadcn token 投影、明暗主题、上游 state variant
├── theme.tsx          # Theme Provider 与 color mode 解析
├── contract.ts        # RendererContract 注册
└── index.ts
```

规则：

1. `@reui/*` 只用于 shadcn CLI 的 registry 地址，不成为 Lumi 运行时依赖。
2. 复制后的源码直接编译进 `@duxweb/lumi-ui-shadcn`；仍需声明其真实底层依赖，例如 Radix、TanStack Table/Virtual、dnd-kit、date-fns、Recharts 或 Motion。按 monorepo 约定，共享单例放入 `peerDependencies + devDependencies`，版本来自 pnpm catalog。
3. 只引入实际采用的组件及依赖，禁止安装 ReUI 整站依赖。
4. `internal/` 不承载 Lumi 业务逻辑；中立属性转换、事件归一化和 Schema 语义只写在 `components/`。
5. `components.json` 的 alias 直接指向 `src/internal`；每次 registry 安装后检查并修正 `@/components/ui/*` 等宿主路径，不让示例 alias 泄漏到发布包。
6. 不批量引入 `c-*` 展示案例；只复制被 Lumi wrapper 实际使用的基础或高级组件源码。
7. 包内增加 `THIRD_PARTY_NOTICES.md`、Radix/shadcn/ReUI 许可证和上游来源清单，记录仓库、commit、registry item 与本地修改；ReUI 以其[公共 MIT 仓库](https://github.com/keenthemes/reui/blob/main/LICENSE.md)为授权证据。
8. ReUI 官网 Pro Blocks 只允许在浏览器中外部查看；其源码、安装命令、模板、图标和预览截图均不得下载、提交、打包或成为视觉回归基线。只有能够追溯到公共 MIT commit 或明确免费 registry 的文件才可进入 `internal/reui`。
9. 仓库中的设计 fixture 和截图基线只能由 Lumi 自己的实现生成，不能保存第三方 Pro 预览资产。

`ui-shadcn` 的公共入口只导出中立 `reactAdapter`、Lumi wrapper、已声明 capability、主题 Provider/类型和发布 CSS；不导出 raw Radix、shadcn 或 ReUI 组件 API。直接编写 React 页面时如需复用，也只能使用 Lumi wrapper，不能从 `internal/` 导入。

## 5. RendererContract 与组件目录

### 5.1 契约原则

- Schema 只使用 `value`、`defaultValue`、`disabled`、`loading`、`size`、`appearance`、`side`、`align` 等中立词汇。
- 删除 `modelValue`、HeroUI `variant/fieldVariant`、PrimeVue `severity/inputId/optionLabel` 等具体库词汇。
- adapter 私有 props 不得通过 JSON 透传。
- 组件事件只发原始值；runtime 在唯一入口归一化为命名载荷。
- 标准组件缺失是协议错误，不渲染占位符或静默 fallback。
- 高级能力通过明确 capability 注册；业务自定义组件继续使用 `RendererContract.custom`。

### 5.2 第一阶段标准组件

以下 23 个组件构成必须完整实现的基础目录：

```text
Fragment
Button
Input
Textarea
NumberInput
Select
MultiSelect
Checkbox
CheckboxGroup
RadioGroup
Switch
DatePicker
Form
FormField
Table
Pagination
Dialog
Drawer
Card
Tabs
Upload
Badge
Alert
```

命名收口：

- `Dialog` 是唯一模态对话框名称，删除重复 `Modal`。
- `Alert` 是唯一静态反馈名称，删除 `Message`、`InlineMessage` 等同义标准组件。
- `Badge` 是唯一短状态标记，删除 `Tag/Chip` 同义标准组件。
- `Table` 是中立协议名，React 实现可由 ReUI Data Grid + TanStack Table 驱动。

### 5.3 验证后进入扩展目录

仅当实现、文档、交互测试和明暗主题全部完成后，以下组件才能进入标准扩展目录：

```text
Popover Tooltip Toast Accordion ScrollArea
Combobox OtpInput Slider DateTimePicker
DropdownMenu CommandMenu Breadcrumb Avatar
Progress Skeleton Empty Separator
Frame Filters Stepper Timeline Tree
```

Kanban、Gantt、EventCalendar、TreeTable、CascadeSelect、Transfer、OrderList、VirtualList、Chart、Editor、CodeEditor、OrganizationChart 等先删除或保持 capability/custom，不得为了目录数字提供弱实现。

每次新增标准组件必须同时完成：

```text
props 单源 → generated TS catalog → Rust checker → adapter → 文档 → demo → unit/e2e/axe
```

## 6. 主题与样式所有权

主题链路只有一条：

```text
LumiThemeConfig(JSON)
  → runtime 校验并输出 --lumi-theme-* 种子
  → ui-shadcn 投影为 shadcn 语义 token
  → Tailwind/shadcn/ReUI/Admin Shell 消费语义 token
```

发布前的最终中立主题契约直接在当前协议上收敛，不增加协议版本，也不提供旧字段迁移：

```ts
interface ThemeConfig {
  protocolVersion: string
  mode?: 'light' | 'dark' | 'system'
  primary?: string
  neutral?: string
  radius?: 'sm' | 'md' | 'lg'
  fontSize?: 'sm' | 'md' | 'lg'
  fontSizes?: Partial<Record<
    'caption' | 'label' | 'body' | 'title' | 'section' | 'page' | 'metric',
    number
  >>
  success?: string
  warning?: string
  danger?: string
  info?: string
}
```

- 删除通用 `shadow` 配置：普通布局固定无阴影，浮层使用公共语义 `--shadow-overlay`，不是可配置的品牌主题参数。
- 不增加 `density`：基础控件高度固定为 `28/32/36px`（`radix-nova` 原值），避免不同主题改变布局和可点击区域。
- 中立状态名保留 `danger`；`ui-shadcn` 只在投影层将它映射为 shadcn 的 `destructive`。
- `mode` 表示用户偏好；`system` 由 Theme Provider 监听系统设置后解析为实际 `light` 或 `dark`，DOM 只写解析后的 `data-theme`。

runtime 可输出的公共种子仅包括：

```text
--lumi-theme-primary --lumi-theme-neutral --lumi-theme-radius
--lumi-theme-font-size
--lumi-theme-font-caption --lumi-theme-font-label --lumi-theme-font-body
--lumi-theme-font-title --lumi-theme-font-section --lumi-theme-font-page
--lumi-theme-font-metric
--lumi-theme-success --lumi-theme-warning --lumi-theme-danger --lumi-theme-info
```

`ui-shadcn` 还可生成 adapter 私有的 `--lumi-ui-*` 派生 Token：

```text
--lumi-ui-control-sm --lumi-ui-control-md --lumi-ui-control-lg
--lumi-ui-tone-*
--lumi-ui-font-*
```

这些派生 Token 不属于 Schema，也不能由页面 JSON 直接赋值。

跨层组件只消费公共语义变量：状态色使用 `--success`、`--warning`、`--destructive`、`--info`；浮层统一使用 `--shadow-overlay`。Admin 不得消费 `--lumi-ui-*`。

必须覆盖的 shadcn token：

```text
--background --foreground
--card --card-foreground
--popover --popover-foreground
--primary --primary-foreground
--secondary --secondary-foreground
--muted --muted-foreground
--accent --accent-foreground
--destructive --destructive-foreground
--border --input --ring
--chart-1 ... --chart-5
--sidebar --sidebar-foreground --sidebar-primary
--sidebar-primary-foreground --sidebar-accent
--sidebar-accent-foreground --sidebar-border --sidebar-ring
--radius
```

实现规则：

- `packages/ui-shadcn/src/style.css` 是唯一 Token CSS 真源；仓库不再保留第二套可执行色板或参考稿目录。
- 组件只使用语义 Token 和静态 Tailwind class，禁止直接写品牌色或第三方变量。
- 明暗主题使用同一语义角色，不做简单反色。
- 布局卡片与 Shell 不使用通用投影阴影；层级由背景、留白和单线表达（没有贴合双线这类自创装饰）。阴影只保留给 Popover、Dialog、Dropdown 等真正脱离文档流的浮层。
- adapter 发布物必须自带编译后的 CSS，消费者不需要扫描 `node_modules` 中的内部源码。
- React/Vue headless 包不发布 CSS，不持有默认表单布局或过滤器界面。`LumiFilter` 只转换过滤模型、维护绑定并派发事件，视觉由显式或注入的 `RendererContract.components.Filters` 提供；缺少该组件时报错。仅 React 有官方适配器。
- `LumiFilter` 在 binding 中随 locale 解析 `$t`，并向中立 `Filters` 传递宿主专用 `translate` 回调用于操作文案；函数不进入 JSON Catalog，远程 Schema 不得指定它。

### 6.1 认证与产物边界

- React/Vue 的 `useLogin` / `useLogout` 在同一个 QueryClient 内串行执行。成功后取消 `['lumi']` 命名空间旧查询，移除无订阅缓存，重置有订阅查询并刷新启用的查询；失败不清除原会话，宿主其他查询不受影响。
- 会话数据应由 Lumi 查询加载；不要通过宿主 QueryClient 的固定 `initialData` 为 Lumi 查询注入旧身份，因为 reset 会恢复该初始值。
- 校验器消费由同一 props 真源生成的精简校验元数据，不携带作者文档文本；完整 `protocolCatalog` 仍提供给文档/MCP。生成检查和目录一致性测试阻止两者漂移。
- UI 发布 ESM 启用压缩，同时保留源码映射和声明文件；不放宽体积预算，不用拆分静态 chunk 绕过入口门禁。

## 7. Admin Shell 架构

### 7.1 责任拆分

当前 `LumiAdminShell.tsx` 同时承担菜单推导、搜索、Tab、存储、主题、用户、注销、移动端焦点和两套 DOM。目标拆分为：

```text
createAdmin
  ├── Manifest/Auth/Router/Theme 生命周期
  └── LumiAdminShellProvider
       ├── useShell()         # 唯一状态与动作入口
       ├── LumiAdminShell     # 按 manifest.app.layout 选择内置布局
       ├── LumiAdminSingleShell
       └── LumiAdminDualShell
```

`runtime/admin.ts` 继续保持纯函数，只负责路由展平、访问过滤、菜单创建和来源解析，不加入 React state、DOM 或浏览器存储。

### 7.2 `useShell()` 公共语义

`useShell()` 返回一个中立 Shell facade：

```ts
interface ShellContextValue {
  app: {
    id: string
    title: string
    subtitle?: string
    logo?: string
    layout: 'single' | 'dual'
  }
  menu: readonly AdminMenuItem[]
  groups: readonly AdminMenuGroup[]
  modules: readonly AdminModule[]
  active: {
    pathname: string
    item?: AdminMenuItem
    group?: AdminMenuGroup
    module?: AdminModule
    breadcrumbs: readonly ShellBreadcrumb[]
  }
  navigation: {
    query: string
    collapsed: boolean
    mobileOpen: boolean
    setQuery(value: string): void
    toggleCollapsed(): void
    openMobile(): void
    closeMobile(): void
    navigate(path: string): void
  }
  tabs: {
    enabled: boolean
    items: readonly ShellTab[]
    activeKey?: string
    activate(key: string): void
    close(key: string): void
    closeOthers(key: string): void
    closeAll(): void
    reload(key: string): void
  }
  identity: {
    value?: AdminIdentity
    pending: boolean
    error?: unknown
  }
  colorMode: {
    preference: 'light' | 'dark' | 'system'
    resolved: 'light' | 'dark'
    set(value: 'light' | 'dark' | 'system'): void
    toggle(): void
  }
  auth: {
    pending: boolean
    error?: unknown
    logout(): Promise<void>
  }
}
```

实施约束：

- 初版使用单一 Context + `useReducer`，不引入额外状态库；只有真实性能数据证明需要时才增加 selector/store。
- Tab 持久化只保存 `{key,path}`，标签由当前 locale 和 menu 动态推导，避免语言切换后陈旧。
- `AdminManifest.app` 与 `app.id` 在最终协议中改为必填；默认存储命名空间为 `lumi:${app.id}:shell`，程序配置中的 `shellStorageKey` 只能显式覆盖它。
- storage 不可用、配额不足或内容损坏时，Provider 丢弃该份持久化数据并退回内存状态；不能阻塞 bootstrap，也不能显示错误页面，但需要输出可诊断 warning。
- `tabs.reload(key)` 只做原位 Schema 重新获取与查询失效：活动 Tab 立即 revalidate，非活动 Tab 标记 stale 并在激活时 revalidate；不得更换 route element key 或 remount 页面。
- `colorMode.toggle()` 以当前 `resolved` 为基准，写入相反的显式 `light` 或 `dark` 偏好；只有 `set('system')` 才恢复跟随系统。
- 活动路由使用“最长路径匹配”，避免父路由先命中。
- Shell 状态更新不得 remount 页面内容；用 mount-count 测试锁定。
- 认证检查只发生在应用 bootstrap 或明确的 session 失效时。路由切换不得出现 `Checking session` 页面闪烁；首次检查使用无文字布局 Skeleton。

### 7.3 可替换 Shell

Manifest 只表达可序列化意图：

```json
{
  "app": {
    "id": "console-admin",
    "layout": "dual",
    "tabs": true
  }
}
```

React 组件注入只存在于程序配置：

```ts
createAdmin({
  shell: CustomShell
})
```

只有多个基座必须共享同一 `app.id` 且仍需隔离状态时，才传 `shellStorageKey` 覆盖默认命名空间。

自定义 Shell 只接收页面 `children` 并调用 `useShell()`；它不接收 adapter、RendererContract、Manifest loader 或 auth provider。未提供自定义 Shell 时，`LumiAdminShell` 根据 `app.layout` 选择 `single` 或 `dual`。

## 8. 两套内置 Shell

### `single`

- 一列完整业务导航。
- 品牌/工作区选择器在顶部，分组菜单居中滚动，用户与全局动作固定底部。
- 适合菜单量中等、模块切换不频繁的后台。

### `dual`

- 第一列窄 rail 负责模块切换和全局动作。
- 第二列上下文导航展示当前模块的分组菜单。
- 主内容区包含 header、Tab strip 和 route outlet。
- 适合多模块、多租户或高频切换的后台，作为默认布局。

两套 Shell 共享同一 Provider、Tab、用户、搜索、主题、移动导航和注销逻辑，只允许 DOM 布局不同。详细边框、分割线和选中态见 UI 标准。

## 9. Admin 页面组件

Admin 页面不直接导入 Radix、shadcn 或 ReUI。通用控件由传入的 `RendererContract` 渲染；产品层只组合页面语义和数据流。

第一批页面构件：

| 组件 | 职责 |
| --- | --- |
| `LumiPage` | 页面滚动、宽度和状态边界 |
| `LumiPageHeader` | 标题、说明、面包屑、主次操作 |
| `LumiDashboardPage` | 指标、趋势和快捷信息布局 |
| `LumiListPage` | Filters、Table、Pagination、批量操作 |
| `LumiFormPage` | 表单分区、保存状态、离开确认 |
| `LumiDetailPage` | 描述区、时间线、关联数据 |
| `LumiSettingsPage` | 左侧设置目录和右侧表单内容 |
| `LumiPageFrame` | 对中立 `Frame` 的 Admin 页面组合，统一 header/body/footer |
| `LumiDataGrid` | Admin 表格编排，底层使用中立 `Table` |
| `LumiFilterBar` | 搜索、快捷筛选、展开筛选和清空状态 |
| `LumiEmptyState` | 可恢复的空态、错误态和首次引导 |

ReUI Data Grid、Filters、Frame、Stepper、Timeline 等公共 MIT 源码应先进入 `ui-shadcn` 并适配为中立组件，再被 Admin 组合；禁止从 `admin-react` 直接 import `@reui` 或内部 shadcn 文件。

## 10. 开发里程碑

每个里程碑结束时必须形成可运行产品，不允许长期保留半套 adapter。

### M0：协议与删除清单冻结

- 先同步 `AGENTS.md`、`.ai` 规则和项目技能中的目标包结构，删除 HeroUI/Nuxt UI/双端视觉硬约束，避免实施期继续执行旧架构。
- 冻结 23 个基础组件和第一批扩展名称。
- 项目尚未发布：保持当前 `PROTOCOL_VERSION`，直接修改当前协议；不新增版本、不保留旧字段、不实现迁移器或 fallback。
- 冻结最终 `ThemeConfig`、必填 `AdminManifest.app.id`、Shell storage 与 reload 语义。
- 决定每个旧组件是保留、合并、capability/custom 还是删除。
- 更新 `component.ts`、props、事件映射、generated catalog 和 Rust checker 计划。
- 建立旧路径全仓引用清单和 ReUI 源码来源清单。

验收：目录清单无同义名、无 HeroUI/PrimeVue 私有 props、所有删除项都有对应引用处理目标。

### M1：UI adapter 与标准协议原子切换

本里程碑内部可以先用 `Button/Input/Form/FormField/Card/Dialog/Table` 跑通纵向切片，但这只是施工顺序，不是可发布节点。在 23 个基础组件和全部消费者完成前，不改公共包名、不切默认 adapter，也不引入临时兼容或占位实现。

- 将 `ui-hero` 最终原子改造为 `ui-shadcn`，初始化 shadcn Radix + Tailwind v4，建立 Token 投影与包内编译 CSS。
- 完成全部 23 个基础组件，以及 overlay、受控/非受控、表单错误和事件载荷回归。
- 删除未支持组件的 Schema 名称、props、adapter 注册、生成文档、fixture 和测试；将 `modelValue` 等具体框架词汇直接改为最终中立语义。
- 重建 TypeScript catalog 与 Rust wasm checker。
- 在同一切换中更新所有 Schema/Manifest/Theme 生产者与消费者：runtime、MCP、checker、docs、示例、测试 fixture、缓存键、React/Vue headless binding 和后端示例；旧结构直接报错，不做兼容读取。
- 原子迁移所有 `ui-hero` 消费者和配置引用，包括 `apps/admin-react`、docs、playground、React 示例、create template、共享 tsconfig/Vitest/Playwright alias。
- 先将 React 仍需的 mock、schema 检查入口和 Playwright server 移到 React app 或中立 scripts，再删除 `ui-nuxt`、`admin-vue`、`admin-vue-cdn`、Vue UI 应用/示例及其专属脚本和 E2E。
- 删除已无消费者的 `ui-recipes`、UnoCSS 扫描/构建配置，并同步清理 workspace catalog、共享 tsconfig、Vitest、Playwright、root scripts 与 lockfile。
- 加入 ReUI MIT notice、来源 commit、真实 peer/dev dependencies 和许可证审计。

验收：标准目录 23/23 完整注册且没有占位；React Admin 可登录、导航并渲染 Dashboard/List/Form；未知或旧组件在作者期报结构化错误；全仓无 HeroUI/Nuxt UI/具体 Vue UI Admin 运行路径；根级 typecheck/lint/test/build/check:schema/E2E 与 axe 全绿。

### M2：Shell 状态拆分与双布局

- 落地 `LumiAdminShellProvider`、`useShell()`、`LumiAdminSingleShell`、`LumiAdminDualShell`。
- 把 package-owned Shell CSS 从 demo 移回 `admin-react`。
- 加入自定义 Shell 注入和 namespaced storage。
- 修复最长路径匹配、Tab locale 陈旧和路由切换 session 检查闪烁。
- 完成桌面、平板、手机导航与焦点管理。

验收：同一 Manifest 可切 single/dual；切换 Shell 不改变菜单、Tab、用户和主题行为；任意 Shell 操作不 remount 页面。

### M3：Admin 页面体系

- 完成 Dashboard、List、Form、Detail、Settings 页面构件。
- 引入并适配经确认的 ReUI MIT Data Grid、Filters、Frame、Stepper、Timeline。
- 统一表格、表单、空态、错误态、加载态和保存反馈。
- 用真实 Admin 页面完成明暗主题视觉验收。

验收：五类页面不写第三方私有 props；所有卡片/表格/表单遵守 `ui-design-spec.md`；键盘、屏幕阅读器和触控回归通过。

### M4：React-first 产品收口

- 对已经可构建的 React-first 工作区做产品化收口，不在本里程碑留下任何破坏性包删除。
- 保留 `lumi-vue` headless package 的编译和单元测试，但从 UI/Admin 文档和预览中移除。
- 完成 docs、playground、create template、foundation 示例的 React-first 内容、安装路径和 API 校对。
- 完成旧包名、私有 props、过期截图、孤立依赖和未使用脚本的零引用审计。
- 固化 Dashboard/List/Form/Detail/Settings 的 Lumi 自产视觉基线与发布体积预算。

验收：全仓没有 `@heroui/*`、`@nuxt/ui`、`lumi-ui-hero`、`lumi-ui-nuxt`、Vue Admin 发布入口；root 命令不遍历已退役路径。

### M5：升级机制与发布门禁

- 固化 shadcn/ReUI 升级流程：`--dry-run` → `--diff` → 人工合并 → wrapper/视觉/axe 回归。
- 增加 upstream manifest、许可证检查，以及禁止 Pro 源码、资产、预览截图和基线文件的 CI 规则。
- 输出新的组件 Catalog、API 文档、LLM 文档和 changeset。
- 记录 adapter CSS 体积、JS chunk 和高级 capability 动态加载基线。

验收：完整门禁全绿，包发布内容无站点源码、无 Pro 文件、无未声明依赖。

## 11. 测试与门禁

### 必跑命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:schema
pnpm e2e
```

### 专项矩阵

- Schema：目录生成一致、私有 props 拒绝、未知组件错误、事件载荷稳定。
- Adapter：23 个基础组件全部注册；明暗主题；受控/非受控；disabled/loading/error；Portal 和焦点恢复。
- Shell：single/dual、自定义 Shell、菜单搜索、最长路径、Tab 增删/恢复、storage 隔离、身份、主题、注销、移动焦点。
- 页面：Dashboard/List/Form/Detail/Settings 的 default、empty、loading、error、permission denied 和大数据状态。
- 可访问性：axe AA、键盘全链路、focus-visible、Dialog title、触控目标、reduced motion。
- 视觉：至少 1440px、1024px、390px；light/dark；基线只由 Lumi 实现生成，截图对比容差由稳定区域定义，不用整页高容差掩盖偏差。
- 架构：`admin-react` 禁止导入 Radix/shadcn/ReUI；`schema/runtime/core` 零 UI；旧包名和 Pro 内容禁止回流。

## 12. 完成定义

只有同时满足以下条件，本轮架构迁移才算完成：

1. React Admin 是唯一完整、公开、可运行的 UI/Admin 产品路径。
2. `ui-shadcn` 对外只暴露 Lumi 中立契约，内部 Radix/ReUI 参数不可从 Schema 使用。
3. 23 个基础组件、双 Shell 和五类 Admin 页面全部有实现、类型、文档、测试和明暗主题。
4. HeroUI、Nuxt UI、Vue Admin、旧 recipe 和未支持组件已物理删除。
5. 页面切换不再出现 session 检查闪屏，Shell 逻辑可被任意自定义布局复用。
6. ReUI 使用范围可从 notice/commit 清单审计，公共发布物不含 Pro 代码。
7. typecheck、lint、test、build、schema checker、E2E 和 axe 全绿。

## 13. 已知风险与控制

| 风险 | 控制 |
| --- | --- |
| 134→小目录是破坏性变化 | 项目未发布，直接收敛；保留删除/合并决策表供实施核对，Schema 对旧名称立即硬失败 |
| ReUI 源码升级覆盖 Lumi 修改 | 上游源码与 wrapper 分目录；只用 CLI diff/人工合并，不直接 overwrite |
| 误混入 Pro 内容 | Pro 仅允许官网外部查看；CI 同时检查来源、许可证、源码和图片资产，基线只由 Lumi 生成 |
| Radix Portal/焦点回归 | Dialog/Popover/Select/Menu 独立键盘与 axe E2E |
| 发布 CSS 缺类 | adapter 在构建时编译完整 CSS，消费者不负责扫描内部源码 |
| Vue headless 被误认为完整支持 | 文档明确标注“无官方 UI/Admin adapter”；不提供 Vue 视觉预览 |
| Shell Context 造成无谓渲染 | 初版保持简单 reducer；用 page mount-count 和 profiler 数据决定是否拆 selector |
| 删除 Vue app 破坏共享 mock/check 脚本 | 先移动共享能力到 React app或中立 scripts，再删除旧 app |
