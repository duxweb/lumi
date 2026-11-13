# Lumi React Admin UI 设计标准

> 本文是 React Admin 的唯一视觉与交互规范，配合 [`README.md`](./README.md) 使用。
> Token 真源只有 `packages/ui-shadcn/src/style.css`。仓库不保存参考稿、第三方预览或第二套可执行 CSS；唯一的视觉基线是 `e2e/react-admin.spec.ts-snapshots/` 里由 Lumi 自己实现生成的截图。

## 0. 2026-09-19 迁移补充（优先）

本文保留现有视觉、交互、响应式与可访问性要求；包结构与 API 以 [当前计划](./README.md) 为准。本次迁移不重新设计产品外观，也不依据早期文字恢复已被后续用户调整替代的布局。

- 现有 UI 在 `packages/ui-shadcn`，目标移入 `packages/ui`；Admin 从 `packages/admin-react` 移入 `packages/admin`。改路径时同步 CSS、来源记录与资产清单，不复制第二套主题源。
- 下文的 RendererContract、标准 Schema 目录、`withCharts(contract)`、`LumiContractSlots` 等均为旧实现说明，不构成兼容要求。组件与图表使用原生 Catalog/Registry，JSON 可用原生 named slots；React 专属 slot/callback 不进入 JSON。
- 桌面头像位于 Header 右端；旁边保留单图标主题切换，支持 light/dark/system 并显示相应图标；头像菜单继续提供主题与注销。此项覆盖 §5 中较早的 rail 底部头像、Header 禁止账户/主题规则。
- 表格与列表保留后续已接受的平铺层级、独立卡片面及有底色/圆角的表头，不恢复“所有 Table 强制套 Frame”或“表头禁止底色”的旧要求。Frame 是可选 UI 构件，不能因改渲染器恢复重复外框。
- 普通表单、发布页、设置页按各自内容宽度自适应；设置页保留无卡片分区、低对比度虚线、左文右表及窄屏单列。页面不重复 Shell 面包屑。
- 仪表盘保持 full 可用宽度（见 §9.5）；Card list 保留现有独立布局约束，不由仪表盘的 full 规则覆盖。
- 图表的 props 定义归 UI Catalog，原生 VChart spec 留在 UI 内部；按需引擎加载、销毁、主题与数据明细要求保留，旧包名及 adapter capability API 淘汰。
- 以当前 Lumi 自产 UI、已接受的后续调整和对应功能/视觉测试核对迁移结果；旧 `#mk-*` 的尺寸记录仅为历史说明，不恢复删除的设计稿，也不获取第三方 Pro 基线。

## 1. 设计简报

### 使用者与任务

Lumi Admin 面向长期使用企业后台的开发者、运营人员和管理者。最重要的任务是在高信息密度下快速确认当前位置、切换业务模块、处理列表和表单，同时始终知道操作是否成功、是否仍有未保存内容。

### 方向

默认视觉就是 shadcn `radix-nova` 本身：chroma 0 的纯中性灰、近黑/近白的 `primary`、shadcn 自己的间距圆角字号尺度。层次依靠中性色面、留白与单线建立；不发明第二套设计语言。支持完整明暗主题，不使用玻璃拟态、霓虹、渐变文字、装饰性迷你图表或通用大阴影。

未设主题种子时，adapter 输出的每个中性值必须与上游 shadcn neutral 完全一致（浅色 `--background: oklch(1 0 0)`、`--primary: oklch(0.205 0 0)`；深色 `--background: oklch(0.145 0 0)`、`--card: oklch(0.205 0 0)`、`--muted: oklch(0.269 0 0)`、`--primary: oklch(0.922 0 0)`、`--border: oklch(1 0 0 / 10%)`）。品牌色是可选种子，不是默认外观。

### 主要布局

- Shell 提供 `single` 与 `dual` 两种布局。
- 主内容由 Header、Tab strip、Page outlet 三层组成。
- 页面以 Frame 组织标题/工具和内容面，但不把每段文字都包成卡片。
- 高级能力通过筛选展开、行内操作和侧边 Drawer 渐进展示。

### 必备状态

所有 Shell、页面和组件必须覆盖：default、hover、focus-visible、active、disabled、loading、empty、error、success、permission denied、offline/timeout，以及内容极长和数据量极大的状态。

## 2. Token 体系

### 2.1 两层模型

运行时只输出可序列化主题种子：

```text
--lumi-theme-primary
--lumi-theme-neutral
--lumi-theme-radius
--lumi-theme-font-size
--lumi-theme-font-caption ... --lumi-theme-font-metric
--lumi-theme-success
--lumi-theme-warning
--lumi-theme-danger
--lumi-theme-info
```

`mode` 是 Theme Provider 管理的 `light | dark | system` 偏好，不作为 CSS 色值；DOM 只写解析后的 `data-theme="light|dark"`。协议不提供 density，控件高度固定为 28/32/36px（`radix-nova` 的 `h-7`/`h-8`/`h-9`）；中立 `danger` 只在 adapter 投影为 shadcn `destructive`。

`--lumi-theme-neutral` 的默认值是 shadcn 自己的中性灰 `oklch(0.556 0 0)`，且每个混合百分比都按 Oklab 的线性明度推导，使未设种子时的结果精确落在上游值上。根元素的 `font-size` 必须保持 rem 基准（默认 16px），只有 `body` 降到 `text-sm`——否则 shadcn 全部基于 rem 的尺寸会被整体缩放。

`ui-shadcn` 将种子投影为 shadcn 语义 Token。组件只消费：

```text
background/foreground
card/card-foreground
popover/popover-foreground
primary/primary-foreground
secondary/secondary-foreground
muted/muted-foreground
accent/accent-foreground
destructive/destructive-foreground
border/input/ring
sidebar/sidebar-foreground/sidebar-primary/sidebar-accent/sidebar-border/sidebar-ring
chart-1 ... chart-5
radius
```

adapter 可以生成不进入 Schema 的私有派生 Token：

```text
--lumi-ui-control-sm/md/lg
--lumi-ui-tone-*
--lumi-ui-font-*
```

跨层浮层阴影统一使用公共 `--shadow-overlay`，状态色使用公共 `--success`、`--warning`、`--destructive`、`--info`。Admin 不读取 adapter 私有派生变量。

Frame 的表面由 `internal/reui/frame.tsx` 自己持有（上游行为），不再从样式表投影 `--lumi-ui-frame-*`；线条一律直接用 `--border`，不再有 strong/soft 两档。

组件结构以 shadcn Radix + Nova 为起点，但 Nova 只提供可维护的组件骨架；最终颜色、线条、层级、密度和圆角必须由本文与 Lumi Token 决定。

禁止：

- HeroUI、Nuxt UI、Prime、Ark 或 ReUI 私有 CSS 变量出现在协议和 Admin 层。
- 组件直接使用固定品牌色。
- 页面自行定义第二套明暗色板。
- 给中性色掺入品牌色偏；未设种子时中性色的 chroma 必须为 0。
- 在 `config/lumi.tailwind.css` 与 adapter 的 `@theme inline` 之间使用不一致的 `--radius-*` 阶梯——同一个 `rounded-lg` 在两套 Tailwind 构建里必须解析成同一个值。
- 在 `style.css` 里为控件的 `outline` 外观补写 `border-color` / `background`：这些规则不在 `@layer` 内，会盖掉组件自带的 `focus-visible:` 和 `aria-invalid:` 工具类，等于悄悄关掉聚焦环和错误态。`outline` 就是组件默认外观，不需要任何规则；只有 `filled` 需要覆写，且必须用 `:not(:focus-visible, [aria-invalid="true"])` 把边框让给状态。

**两套 Tailwind 构建的顺序约束。** `admin-react` 自带 Tailwind 构建，其样式表在 adapter 之后加载，所以它输出的任何**基础**工具类都会盖过 adapter 内部"变体压基础"的写法（例如 admin 里写一个 `bg-transparent`，就会让所有 `[data-slot="input"]` 的 `dark:bg-input/30` 失效）。反过来调换加载顺序也不行——那会让 admin 自己的 `md:flex` 输给 adapter 的 `hidden`。因此约束是单向的：**Admin 层不得使用 adapter 依赖变体覆盖的基础工具类**，需要透明背景时用 `bg-inherit`。`packages/admin-react/test/shell.test.tsx` 对此有回归断言。

### 2.2 明暗层级关系

采用 shadcn 自己的次序，不再自建阶梯。Dark 模式：

```text
background oklch(0.145)   页面底，最深
  < card / popover / sidebar oklch(0.205)
    < muted / accent / secondary oklch(0.269)   hover、选中、Frame 外框
```

即 `muted` 高于 `card`：卡片相对页面浮起，hover 行相对卡片再浮起。`--border` 与 `--input` 使用半透明白（10% / 15%），跟随身下的表面变化，而不是一条固定灰线。

Light 模式不是机械反色：页面、卡片、弹层都是纯白，层次由一条 `oklch(0.922)` 发丝线和 `oklch(0.97)` 的 hover 面建立。

`primary` 默认就是中性极值（浅色近黑、深色近白）；品牌色只有在主题显式给出种子时才出现。

## 3. 字号、密度与圆角

| Token | 默认 | 用途 |
| --- | --- | --- |
| caption | 12px | Badge、分组标签、时间戳 |
| label | 14px | 表单标签、菜单、Tab、辅助信息 |
| body | 14px | 输入、按钮、正文、表头与单元格 |
| title | 16px | 卡片/弹窗标题（字重 500，不是 semibold） |
| section | 20px | 页面区块标题 |
| page | 24px | 页面标题 |
| metric | 30px | 指标数值 |

shadcn 只有 `text-xs` / `text-sm` / `text-base` 三档跑文字，表头与单元格同为 14px，表头不降到 12px。

统一控件高度（`radix-nova` 原值）：

| Size | 高度 | 用途 |
| --- | --- | --- |
| `sm` | 28px | 表格、筛选、紧凑工具栏 |
| `md` | 32px | 默认表单与按钮 |
| `lg` | 36px | 强调操作 |

圆角阶梯必须与 shadcn 一致：`--radius` = 10px，`sm` 6 / `md` 8 / `lg` 10 / `xl` 14。按钮与输入用 `rounded-lg`；Card、Frame 与内板用 `rounded-xl`；只有状态 Badge 用胶囊。

间距：页面内边距恒定 16px，区块间距 16px，卡片内边距 16px，表格单元格 8px、边列补到 16px。页面留白本身不随视口浮动（不给 padding 写 `clamp()`）。

一般区块标签为 12px / 600 / uppercase；表单的独立分组采用 `font-title`（默认 16px）/ 600 / sentence case，明确区分分组标题和字段标签。

### 3.1 内容宽度

列表和仪表盘吃满可用宽度；有阅读方向的页面必须限宽，否则 1440px 下一行表单字段会拉到 1200px 宽而无法扫读。基础布局宽度按下表约定；卡片列表等独立组件遵守其已经验收的布局约束：

| 档 | 宽度 | 用在哪 |
| --- | --- | --- |
| full | 100% | 列表页、仪表盘 |
| form | `min(100%, 960px)` | 普通表单（`centered` / `tabs` / `steps`） |
| publish | 最大 1280px，`1fr + 320px` | `publish` 表单：主体 + 右侧发布栏 |
| settings | 内容轴 `min(100%, 1120px)`，分割线 full | 设置页：横向 Tabs + 左文右表分区 |
| detail | `1fr + 320px` | 详情页：主体 + 右侧属性栏 |

表单根据容器而不是视口换列：发布区可用宽度 <880px 时侧栏移到主体下方，字段分组宽度 <480px 时单列。详情页保持原视口断点。

## 4. 线条与层次规则

这是 Shell 与页面视觉成立的关键，不得用通用 box-shadow 代替。

### 4.1 只有单线

结构一律用一条 1px `--border`。明确禁止：

- 贴合双边框（外深内亮的两条相邻线）。
- 用伪元素叠出第二条线制造斜面/刻痕。
- 给 workspace selector、导航项或卡片加装饰性外框。

shadcn 的 sidebar 没有这些东西；workspace selector 就是一个普通的菜单按钮——方形图标 + 名称 + chevron，静态无描边，只有 hover 底色。

### 4.2 分割线

- 导航组之间不画线：靠分组标签（32px 高、12px、`muted-foreground`）和留白分隔。
- rail、context sidebar、main 之间的竖向边界：只用一条连续 1px 线。
- Header 底部、Tab strip 底部：单线。
- 表头没有底色带，只有一条 `border-b`；色带留给 `tfoot`。
- 禁止给 main 区域额外添加左边和上边框，导致边框归属错位。

### 4.3 阴影

- Shell、workspace selector、导航选中项、Frame 和普通 Card 不使用装饰性阴影。
- Popover、Dropdown、Tooltip、Dialog、Drawer 等脱离文档流的浮层可以使用一档克制阴影。
- 禁止 `!important` 覆盖自己组件的阴影；应从原规则删除不需要的声明。

## 5. Shell 标准

### 5.1 Single Shell

```text
┌──────────────────┬─────────────────────────────────────────┐
│ workspace        │ header                                  │
│ grouped menu     ├─────────────────────────────────────────┤
│                  │ tabs                                    │
│                  ├─────────────────────────────────────────┤
│ user/global      │ page outlet                             │
└──────────────────┴─────────────────────────────────────────┘
```

- Sidebar 可滚动，workspace selector 和底部用户区不随菜单滚走。
- 菜单分组标题与项目形成明显节奏，不使用等间距列表堆满整列。
- 选中项只使用中性填充面 `sidebar-accent` + `font-medium`，图标不染主色，不加边框、投影或发光。

### 5.2 Dual Shell

```text
┌──────┬──────────────────┬──────────────────────────────────┐
│ rail │ workspace        │ header                           │
│      │ contextual menu  ├──────────────────────────────────┤
│      │                  │ tabs                             │
│      │                  ├──────────────────────────────────┤
│ user │                  │ page outlet                      │
└──────┴──────────────────┴──────────────────────────────────┘
```

- Rail 只承载模块图标、全局动作、通知和用户，不复制上下文菜单文字。
- Context sidebar 展示当前模块的分组菜单、搜索和工作区选择。
- Rail 与 Context sidebar 各自只有一条右边界，Header 只有下边界。
- workspace selector 是普通菜单按钮，没有边框，只有 hover 底色。

### 5.3 Header 与 Tabs

- Header 左侧显示面包屑或当前上下文，右侧放搜索、通知等页面级动作，按钮统一 36px ghost。
- Tab strip 是路由工作区，不与页面内 Tabs 混用语义。
- Tab strip 使用 line 变体：40px 高，与 strip 底线共用一条 `border-b`（页签 `-mb-px` 压上去），激活项是 `border-foreground` 的 2px 指示条 + `font-medium`，非激活项 `muted-foreground`。不使用 `bg-muted` 分段药丸——路由页签是"我开着哪些页面"，不是一组互斥选项；也不使用主色指示条。
- 关闭按钮常驻 `opacity-70`，hover/focus 提到全不透明。它不能只在 hover 出现：触摸设备没有 hover。
- Tab 过多时横向滚动并提供溢出菜单（`data-testid="admin-tabs-overflow-menu"`），不能压缩到不可读。

### 5.4 用户入口

用户头像是一个入口，不是散落的一排图标。主题切换和退出登录都在这个菜单里，页面上不再单独放主题按钮或退出按钮。

- 菜单宽 240px（`w-60`），`p-1`，普通项 32px。
- 主题是**一行分段控件**，不是三行菜单项：左侧 `Theme` 标签，右侧 `ml-auto` 一条 28px 轨道（`bg-muted`、`p-[3px]`、`rounded-lg`），内含 Light / Dark / System 三个 `menuitemradio`（12px 字号、`px-2`、`rounded-md`）。选中项浅色 `bg-background` + `0 1px 2px oklch(0 0 0/.08)`，深色 `oklch(1 0 0/6%)` 且无阴影。堆成三行要花三行说一件事，而分段控件一眼就同时给出全部选项和当前值。
- Dual Shell：入口在 rail 底部（`placement="rail"`，只有头像）。
- Single Shell：入口在 header 右端（`placement="header"`，头像 + 名称），sidebar 底部不再重复一个退出块。
- Mobile <768px：入口在移动导航面板里；那里保留一个明暗切换图标按钮，因为面板里没有头像菜单。
- 路由切换保留 Shell，不显示 `Checking session`；内容加载使用页面级 Skeleton。

### 5.5 Header 右端

Header 右端是宿主插槽（`createAdmin({ headerEnd })`），不是账户区。设计稿 13 张页面里有 12 张在这里只放**一个 32px ghost 图标按钮**（`aria-label="Notifications"` 的铃铛），与 header 的 16px 右内边距对齐。

- Shell 只出借插槽和 `LumiShellIconButton`（32px、`rounded-lg`、透明底、hover `bg-accent`）；通知是什么由宿主决定，Shell 不能替宿主发明这个功能。
- 主题和账户不在这里：它们属于人，归头像菜单。
- 已知偏差：设计稿的仪表盘用一个页面级的 `Last 8 days ▾` 换掉了铃铛。当前架构里页面控件归页面，没有 page→header 通道，因此仪表盘同样显示铃铛。

## 6. Frame、Card 与页面内容面

### 6.1 Frame

Frame 是 ReUI 给数据网格用的双层容器，不是通用页面包装：

```text
outer well：bg-muted/50 + 1px border + rounded-xl + 3px padding
├── header / tools（可选，位于 well 上）
├── inner panel：bg-background + 1px border + rounded-xl + shadow-xs
└── footer / summary（可选）
```

- 表面逻辑属于 `internal/reui/frame.tsx`（上游行为），样式表不再覆写。
- 四边包覆统一 3px。
- well 的 header 是一行 **48px**（8px 上下留白 + 32px 控件），左右内边距 **13px**——加上 well 自己 3px 的内板外圈正好 16px；内板顶部若接统计条，统计条紧贴内板上沿，其后是 **56px** 的工具行（12px 上下留白 + 32px 控件）。这两个数是量出来的，不要凭手感调：工具行只要比 56px 高，统计条和搜索行之间就会裂开一条空带，统计条看上去就不再属于这张表。
- 标题 `text-sm font-semibold`，描述 `text-sm text-muted-foreground`。
- 内板承载表格或全出血工具行时，通过中立的 `data-lumi-fill` 把 `--frame-panel-p` 收到 0，由行自带内边距。
- **Frame 只用于 DataGrid。** 指标卡、说明块、表单区都用普通 Card。

### 6.2 Card

- Card 用于独立语义对象，不用于每一行设置项。
- Card 是单层：`rounded-xl` + `bg-card` + `ring-1 ring-foreground/10`（不是 border），内边距恒定 16px，标题 16px/500。
- 指标卡是 Card，不套 Frame；数值旁的同比用 Badge，不另起一层容器。
- 重要数值不使用无意义 sparkline 装饰；图表必须表达真实趋势或对比。

## 7. 表格与筛选

### 7.1 Table/Data Grid

- Table 外部使用 Frame；标题、说明、搜索和时间范围在 Frame header。
- 内层表格面使用一条轮廓线和统一圆角。
- 表头 40px 高、14px、字重 500、`foreground` 色，只有一条 `border-b`，没有底色带，也没有竖向列分隔线。
- 数据行 44px 高（`padding-block: 8px`），主要靠横向单线分隔；hover 用 `bg-muted/50` 提升一层。
- 状态使用 Badge；行操作默认收敛到 DropdownMenu。
- Loading 使用保持列宽的 Skeleton 行；Empty 在表格内说明原因与下一步；Error 提供重试。

**列语义（`TableColumn.kind`）。** `text | badge | entity | date | datetime | currency | actions`。语义决定对齐和格式，页面不再手写 formatter：

- `currency` 默认右对齐、`tabular-nums`、两位小数；`column.currency` 给 ISO 4217 码时按币种格式化，不给就是纯小数。不猜默认币种。
- `date` / `datetime` 用宿主 locale 的 `Intl` 格式化；adapter 不引入日期库。
- `actions` 列在页面层被压成无标题、56px、右对齐的一列，操作贴住行尾。

**选择与列配置。** 可选择表格的表头第一列是全选 checkbox，部分选中时 `indeterminate`；空表时禁用。列配置是一个 `menuitemcheckbox` 菜单，落在工具行右端，最后一个可见列锁定不可再关（否则表格会变成空白）。`grid.visibleColumns` 一旦由页面显式给出，列配置菜单让位给它。

**合计行。** 汇总走 `<tfoot>`，不是最后一行数据；`emphasis` 的那条用 `font-semibold`。表头没有底色带，色带留给这里。

### 7.2 Filters

筛选分两层，不是一条越来越长的工具栏：

```text
toolbar   搜索 + primary 字段 + [高级 n] + toolbarEnd（列配置等宿主插槽）
advanced  展开后的一整行/多行次要字段 + 重置
```

- `schema.primary` 列出的字段进 toolbar，其余进 advanced 面板；**没有 `primary` 时全部字段留在 toolbar**（回退档，避免一个两字段的筛选被折叠进抽屉）。
- 「高级」按钮上带当前生效的 advanced 条件数；面板是行内展开的 `filters-advanced`，不是 `<details>`，也不是 Drawer。
- 两层用两档尺寸：toolbar 是 32px 一行（搜索框、下拉、`Filters`、`Reset` 全部 `md`），面板里一律降到 28px（`sm`）——铺开的选项按钮本来就是 28px，控件跟着它走。
- 高级面板一个字段一行（设计稿 `.frow`）：左侧 84px 字段名，右侧把选项**横向铺开**成 28px 的 `.fopt` 按钮，行首恒为 `All`，选中项 `bg-primary`。行内边距 `6px 0`、列间距 12px、标签 `padding-top: 7px`。
- 面板里**不放下拉**：枚举少（≤ 6 项）就铺开，读者不点开也知道有哪些值。下拉只留给选项多、或需要搜索的字段，且它属于 toolbar（`primary`），不属于面板。
- 范围字段（`dateRange` / `numberRange`）先铺 `All` + 预设按钮，再跟两个 28px 输入框（数字 104px、日期 132px）作为「自定义」尾巴，中间用短横连起来。预设的选中态和枚举同一套。
- 外围工具区中的输入使用 ghost surface；进入独立 Card/Frame 后才使用完整输入轮廓。
- 筛选改变默认即时生效；远程高成本查询允许显式“应用”。两种模式必须由 Schema 明确，不能组件猜测。
- **不做「已生效条件」chip 汇总行**：条件已经在自己那一行里显示为选中的选项，收起时由 `Filters` 按钮上的数量角标承担，再挂一行 chip 就是同一件事说三遍。
- 单个字段的清除走它那一行行首的 `All`；整组清除走 toolbar 的 `Reset`（无条件时禁用）。
- `toolbarEnd` 是宿主插槽：它不在 `FiltersProps` 里，JSON 文档拿不到它，只有组合元素的宿主能塞东西进去。

## 8. 表单与输入

- Field 由 Label、Control、Description、Error 四部分组成；Error 出现不能造成大范围布局跳动。
- 输入默认使用填充面和可辨轮廓；focus-visible 使用 `ring`，invalid 使用 destructive 语义。
- 搜索等外围控件可使用 ghost 样式，但仍有清晰的 hover/focus 边界。
- Dialog、Drawer 中的 Select/Popover 必须正确处理 Portal、z-index、滚动和焦点返回。
- 保存状态区分 idle、dirty、saving、success、error；离开 dirty 页面需要明确确认。
- 所有无可见 label 的输入必须有可访问名称。

### 8.1 切换行

一行一个开关的设置项不是 Card，也不是 Field：它是两端对齐的一行——左边标题 + 说明，右边控件，行与行之间单线。给每个开关套一张卡会让"六个无关紧要的选项"看起来像六个重要对象。

## 9. 页面骨架

页面骨架只有五种。新页面必须落到其中一种，不允许每个页面自己排一遍布局。

除仪表盘外，页面都把标题放在 Frame 的 well 上，不再有独立页头。**回到上级的路径由 shell header 的面包屑承担**，页面自己不再画第二条：设计稿 02 的每一页在 well 之上都是直接接内容面的，页内再补一行面包屑会把 well 压低一档，并且和 header 里那条说同一件事。`LumiPageBreadcrumbs` 只留给没有 shell 的宿主。

**页面吃满 shell 给的高度**（`LumiPage stretch`）。列表页的分页、表单步骤页的页脚、详情页的两栏都属于"页面的脚"：内容不够长时它们必须留在区域底部，而不是浮在半空、下面拖一大片空 well。`stretch` 只把高度传下去，不设最大高度——内容超过一屏时照常由 shell 滚动。

### 9.1 列表页

```text
well：标题 + 描述 + 页面操作
     ├── 工具行：Filters（两层）+ toolbarEnd（列配置）
     ├── stats / kpis（可选）
     └── 内板：DataGrid + 分页
```

- **列表页没有独立页头。** 标题、描述、主操作都在 Frame 的 well 上。页面顶部再放一个标题会和 well 的标题重复，并把表格压下去一屏。
- `stats` 是同筛选快照的统计条（横排、无卡片，落在内板顶部），`kpis` 是需要单独强调时的指标卡组（在 well 之上，独立成卡）；两者互斥。
- 统计条里的数字默认不带颜色；只有"这个数本身就是问题"的（低库存、逾期）才用 `tone` 上色，配一枚 delta chip 说明它怎么动的——每个数都上色等于没有一个数被强调。
- KPI 卡（`scale="sm"`）是横读的：标签一行，数字、delta chip 和 84px 火花图共用下一行。仪表盘的 `md` 卡才竖排，因为那里数字就是整页的主角。
- 批量操作只在有选中行时出现，出现时不能顶开表格。
- 分页是单行、落在内板底边：`N total` 在左，`Rows per page` + `‹ 页/总页 ›` 在右。只有 4 行结果时它也留在底部——翻页控件不该跟着结果数上下跑。
- 表格不是唯一的结果面。`LumiListPage` 的 `results` 槽可以换掉 DataGrid，工具行、统计和分页仍走同一套 chrome：
  - **card-list**：记录是独立对象（项目组合），用卡片网格，列宽 `minmax(240px, 1fr)`。
  - **search-list**：检索页，条件在上、命中卡片竖叠在下；摘要要能读完，所以不用表格。
- 这两种不是新的页面家族，不要另起原型。只有 `results` 不够用时才加新页面构件。

### 9.2 表单页

四种 layout，由页面声明，不由字段数量猜：

| layout | 形态 | 保存位置 |
| --- | --- | --- |
| `centered` | 限宽、独立分组卡片 | 页面标题右侧 |
| `tabs` | 标题下方紧凑下划线 Tabs + 分组卡片 | Tabs 同行右侧 |
| `steps` | 单一表面内的步骤带、字段和页脚 | 步骤页脚，不重复保存 |
| `publish` | 主体 + 右侧元信息分组卡片 | 页面标题右侧 |

- 页面标题、Tabs、按钮和分组卡片沿同一内容轴对齐；不重复面包屑，也不为已有分组标题的表单添加重复总标题。`formTitle` 仅用于确有独立说明的表单。
- 不在宽卡片里再次缩窄字段区。普通表单整体最大 960px，卡片内边距 24px；容器 <640px 时为 20px / 16px，并允许工具栏换行，保留所有操作。
- `tabs` 在可见页面标题下方，导航仅占文字所需宽度、操作位于同行右侧。激活项使用 2px 下划线；错误分组保留红点。
- 步骤带是内板顶部的一行：24px 圆点（已完成 `✓`、其余序号）+ 标题/说明 + 连接线，`16px 20px` 内边距并压一条下边线。页脚是 `‹ 上一步 | Step n of m | 跳过 | 下一步 ›`，落在内板底边。
- 分组标题使用 `font-title` / 600，说明文字弱化；标题与字段之间留 24px。字段默认两栏、容器 <480px 单栏，整行字段显式声明跨栏。不要嵌套卡片或强制空白高度。
- 未保存态：`Unsaved`；保存成功后短暂显示 `Changes saved`，两者都要进 live region。

### 9.3 设置页

设置页使用 `min(100%, 1120px)` 的单一内容轴：页面标题与说明在上，下面是带整行基线的横向 Tabs。Tabs 只占其文字所需宽度，激活态使用 2px 中性色下划线；不用 pill、Card 或第二层侧栏。

活动 Tab 内按设置分区纵向展开。每个分区按 1:2 分配说明列与控制列，列间距 32px；内容区 <720px 时改成上下堆叠。右侧短字段允许两列，但单个字段不足 240px 时自动换行；长输入、带描述的单选/复选组保持单列。分区自己的保存操作放在右栏底部。分区之间使用 full 宽度低对比度 1px 虚线，不套 Card；所有内部内容沿同一轴线对齐。手机保留全部关键操作并扩大触控尺寸。

### 9.4 详情页

`1fr + 320px`。主体是"这个对象是什么"（属性带 + 行项目表 + 长内容分区），右栏是"关于它的元信息"（归属、Activity 时间线）。属性带用 `repeat(auto-fit, minmax(150px, 1fr))` 自动降列。行项目（订单行、发票行……）是一个走 `fill` 内板的表格，不是描述列表。

- 记录级操作在 well 上、标题与状态徽标之后，和列表页的页面操作同一位置。
- 长内容（描述、备注）用主栏的 `sections` 分区，不塞进 320px 右栏——右栏是拿来扫的，不是拿来读的。
- 两栏共用一条底边，最后一块面板吃满剩余高度：一条记录是一个对象，右栏在半空断掉会让整页看起来没画完。
- 时间线是"发生了什么 → 什么时候"的纵向阅读：时间戳在标题下一行，不与标题同排右对齐（上游默认会让短标题把时间戳甩到最右，长标题又掉到下一行，同一列出现两种形状）。

### 9.5 仪表盘

仪表盘铺满 Shell 扣除导航与页面留白后的可用宽度，不设 1440px 上限；标题、周期操作、指标与分析区域保持同一对齐轴，不重复页面面包屑。四项指标不附装饰性微型图；主要分析采用 2:1 的收入趋势 / 订单分布，再接等宽支付构成 / 客户排名，最近订单单独占满一行。容器小于 800px 时分析面板改为单列，明细表在自己的区域内横向滚动。表单、详情等阅读型页面仍按各自宽度约束布局。

图表通过可选 `@duxweb/lumi-ui-shadcn/charts` 入口集成 VChart 2.1.2，`withCharts(contract)` 注册 `custom.Chart` 与 `capabilities.charts`，不扩展标准 Schema 组件目录。中立 `LumiChartProps` 在 schema 定义；原生 VChart spec 只属于 adapter 内部。支持面积、折线、横向条形、环形图，所有数值提供可展开的语义数据表；空数据与加载失败不能显示虚假图形。主题使用公开 `--chart-1…5`、`--card`、`--border` 等变量，切换主题后重绘，尺寸改变时 resize，离开页面时 release。

引擎在首次挂载图表时加载，基础 adapter 入口不导入 charts；独立引擎 chunk 另设命名体积预算，原有基础 UI / Admin 首包上限保持不变。仪表盘示例仅使用当前 mock 的真实订单汇总：7 / 28 天影响所有交易指标与图表；收入仅统计 paid / packed / shipped，商品数为当前目录库存口径，无历史时不编造同比。

## 10. 覆盖层

Dialog 与 Drawer 都是三段式：**header / body / footer，只有 body 滚动**。长内容把「保存」推出视口是覆盖层最典型的失败。

```text
header  标题 + 描述（常驻）
body    data-slot="lumi-overlay-body"，overflow-y-auto
footer  footerStart 靠左（未保存标记等），主按钮在最右（常驻）
```

- Dialog 内板是 grid，用 `grid-template-rows: auto minmax(0, 1fr) auto` + `max-height: min(85vh, 48rem)` 建立三段；Drawer 是 flex 列，body 取 `flex-1`。这条规则写在 `packages/ui-shadcn/src/style.css`，不改上游 hash-locked 组件。
- footer 里取消在前、确认在后，右对齐后主按钮自然落在最右。
- `footerStart` / `footerEnd` 是宿主插槽，不在 `DialogProps` / `DrawerProps` 里。`footerEnd` 给出时整组替换声明式的确认/取消，用于"应用筛选"这类不是 confirm/cancel 的场景。
- `DrawerProps.size` 的 `sm / md / lg` = **384 / 480 / 720px**：一个短表单、一个完整表单、一个需要列的表格。横向 Drawer 同时受 `min(90vw, size)` 约束。`DialogProps.size` 的 `sm / md / lg / xl` = **384 / 512 / 672 / 896px**，确认类弹窗用 `md`。
- 覆盖层里的表单沿用页面表单的分区：`ui-sect-h` 区块标题 + 两栏栅格，不因为在抽屉里就换一套排版。
- 覆盖层里放表格时，body 用 `data-lumi-fill` 取消自身内边距，让行铺到抽屉边缘——行自带 gutter，body 再补一层就是双重留白。这与 Frame 内板用的是同一个中性开关。
- Drawer 只从 `side` 指定的一侧进出；关闭后焦点回到触发器（见 §13）。
- demo 的落点（设计稿 `#mk-modal` / `#mk-drawerform` / `#mk-drawertable`）：
  - **Modal** 不进路由。Articles 的「New category」是短表单（Name / Parent / Slug，`size=md`）；行上的 Unpublish 是 `tone=danger` 的确认。
  - **Drawer 表单** 走 `?drawer=edit-customer&record=`，480px（`size=md`），列表留在后面；脏关闭走统一 dirty guard。
  - **Drawer 表格** 走 `?drawer=customer-orders&record=`，720px（`size=lg`），body 用 `data-lumi-fill` 让行顶到抽屉边。它只提供搜索 + 一个状态快筛 + 分页，没有完整 Filters / 列配置 / 批量。
- 宿主通过 `useAdminDrawerChrome` 改标题和 footer。`footerStart` / `footerEnd` 是 `LumiContractSlots`，JSON 文档拿不到。
- 与 `#mk-*` 同时取 rect 后对齐的数：遮罩 `oklch(0 0 0 / .5)`（不是上游的 10% + blur）；Dialog 圆角 `--radius`（10px，不是 14）；header 16 / title-desc 间距 4 / footer 12×16，footer 不涂 muted；侧抽屉圆角 0；表抽屉工具行 `0 20px 12px`（高 44，不是 56）。Drawer 头 79、脚 57 与设计稿同高。

## 11. 反馈与交互

- Hover 只改变 surface/foreground，不使用上浮、缩放或发光制造噪声。
- Active 可以有轻微压感，但不移动布局。
- Toast 用于短暂结果；需要用户决策的错误必须留在页面或 Dialog 中。
- Loading 不使用整页阻塞文字；Bootstrap 用布局 Skeleton，局部请求用局部 pending。
- Empty state 说明“为什么为空”和“下一步能做什么”，不只显示图标。
- 动画只服务状态变化，使用短时 ease-out；遵守 `prefers-reduced-motion`。

## 12. 响应式

### Desktop ≥ 1200px

- Dual Shell 完整显示 rail + context sidebar。
- 页面工具栏保持单行，复杂表格允许内部横向滚动。

### Tablet 768–1199px

- Dual Shell 保留 rail，context sidebar 变为可开合 overlay 或紧凑列。
- 页面 Header 和工具栏允许分为两行。
- Dashboard 指标自动降列，不能强行压缩文字。

### Mobile < 768px

- Rail/context sidebar 合并为一个可访问的移动导航 Dialog/Sheet。
- Header 保留导航入口、当前标题和最关键操作。
- Tab strip 横向滚动；核心功能不能直接隐藏。
- 表格按业务选择横向滚动或移动数据列表，不做不可读的等比缩小。
- 所有触控目标至少 44×44px；考虑安全区和软键盘。

## 13. 可访问性门禁

- WCAG AA 和 axe 全绿是发布条件。
- 所有交互均支持键盘；focus-visible 清晰且不被 overflow 截断。
- Dialog、Drawer 必须有可访问 Title；关闭后焦点回到触发器。
- 菜单、Tab、筛选选项使用正确 role，不用视觉相似替代语义。
- 状态不能只依赖颜色；图标需配文本或可访问名称。
- 文本对比度按实际字号检查，弱文字不得承载关键业务信息。
- **弱文字要按它实际所在的底色验收**，不是按页面底色：`muted-foreground` 落在 tint（软徽标、分段控件轨道）上会掉到 AA 线下，必须朝前景色回拉一档。
- **带色组件必须自己声明前景色**。写在 `:root` 上、值里引用 `--lumi-ui-current-tone` 的 token 会在根元素上就地求值成无效值，组件 `color` 于是回落到继承——外层是弱文字时整块标签就跟着变灰。色值混合要发生在知道 tone 的那个元素上。
- **状态色不用 `color-mix(…, black/white)` 推导。** 在 oklab 里往黑白混会把 L 和 C 等比缩掉——越暗越灰，warning 因此被推成土棕（`oklch(.596 .136)` → `oklch(.391 .089)`），而且它比 success/info 多混了一次。软徽标的底与字改为各自钉住 L/C、只从 tone 取 hue（`oklch(from var(--lumi-ui-current-tone) L C h)`）：浅色 L 0.966 / 0.53，深色 L 0.29 / 0.70，chroma 逐 tone 给。neutral 与 primary 的 chroma 必须写 0——它们是无彩色，强给 chroma 会让未定义的 hue 落到 0 而泛红。十组明暗配对实测 4.53–5.49:1。
- **实心底的前景色按实测定，不按惯例。** amber 是唯一亮到白字不够的：种子上白字 4.16:1、黑字 5.05:1，所以 `--lumi-ui-tone-warning-foreground` 是 black。
- **Danger 按钮走填充面，不用 10% 淡底。** 上游 `destructive` 是 `text-destructive` 落在 `bg-destructive/10` 上，默认种子下对比约 4:1，过不了 AA。`appearance=danger` 改用 `--destructive` / `--destructive-foreground` 这一对（浅色白字、深色黑字）。
- Dark 模式单独验收，不能沿用 Light 模式通过结果。

## 14. 视觉验收清单

每次 Shell、Token 或基础组件改动至少检查：

- Single/Dual × Light/Dark。
- 1440px、1024px、390px。
- 未设主题种子时，中性 Token 与 shadcn neutral 逐值一致，chroma 为 0。
- 根元素 `font-size` 是 16px；按钮/输入实测 32px 高、`rounded-lg` 实测 10px、Card/Frame 实测 14px。
- workspace selector 无边框、无阴影，只有 hover 底色。
- 导航分组之间没有分割线；选中项只有中性填充面和 `font-medium`，图标不染主色。
- Frame 四边 3px 统一包覆，外框 `bg-muted/50`、内板 `bg-background`；Frame 只出现在 DataGrid。
- Table header 无底色带；row separator、search ghost、pagination 属于正确层级。
- 路由切换无 session 文案闪烁，无页面 remount。
- 键盘、焦点、Portal、滚动和 reduced motion 正常。

ReUI Pro 预览只允许在官网浏览器中外部查看；不得下载或提交预览截图、源码、图标和模板，也不得把它们用作视觉回归基线。所有仓库内验收截图必须由 Lumi 原创实现生成。
