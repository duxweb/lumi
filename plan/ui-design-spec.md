# Lumi React Admin UI 设计标准

> 本文是 React Admin 的唯一视觉与交互规范，配合 [`README.md`](./README.md) 使用。
> Token 真源是 `packages/ui/src/style.css`（颜色投影）与它导入的 `packages/ui/src/tokens.css`（公共字号、字重、圆角、间距与尺寸）。仓库不保存参考稿、第三方预览或第二套可执行 CSS；唯一的视觉基线是 `e2e/react-admin.spec.ts-snapshots/` 里由 Lumi 自己实现生成的截图。

## 0. 适用范围与迁移路径

本规范只规定视觉和交互结果；架构与包处置以 [README.md](./README.md) 为准。UI 位于 `packages/ui`，Admin 位于 `packages/admin`。源码路径、来源记录和视觉测试已随原生架构迁移；继续维护这一套主题。

组件、事件、图表与 slots 按原生 Catalog/Registry 实现；旧 Schema/UI 实现 API 名称不构成兼容要求。JSON 可以使用原生 named slots，React 专属 callback/ReactNode 不进入 JSON。历史视觉稿和被替代规则见 tasks/archive；以下正文是当前有效要求，不再依靠互相冲突的补充条款。

## 1. 设计简报

### 使用者与任务

Lumi Admin 面向长期使用企业后台的开发者、运营人员和管理者。最重要的任务是在高信息密度下快速确认当前位置、切换业务模块、处理列表和表单，同时始终知道操作是否成功、是否仍有未保存内容。

### 方向

2026-09-21 用户选定临时提案 A：采用 Vercel / Geist 方向的分区卡片布局，继续使用已有 shadcn/Radix 组件和中性色语义 token。工作区使用淡灰底，独立卡片使用 card 表面；以细边框、克制圆角、明确标题和留白区分层次。支持完整明暗主题，不使用玻璃拟态、霓虹、渐变文字、装饰性微型图表或通用大阴影。

未设主题种子时，UI 实现 输出的每个中性值必须与上游 shadcn neutral 完全一致（浅色 `--background: oklch(1 0 0)`、`--primary: oklch(0.205 0 0)`；深色 `--background: oklch(0.145 0 0)`、`--card: oklch(0.205 0 0)`、`--muted: oklch(0.269 0 0)`、`--primary: oklch(0.922 0 0)`、`--border: oklch(1 0 0 / 10%)`）。品牌色是可选种子，不是默认外观。

### 主要布局

- Shell 提供 `single` 与 `dual` 两种布局。
- 主内容由 Header、Tab strip、Page outlet 三层组成。
- 页面按内容组织标题、工具和独立内容面；Frame 可选，不为页面增加重复外框。
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
--lumi-theme-info        # 默认跟随 brand：设计稿里 info 就是品牌蓝
--lumi-theme-chart-4     # 图表第四色，独立于 info，避免与 chart-1 撞色
```

`mode` 是 Theme Provider 管理的 `light | dark | system` 偏好，不作为 CSS 色值；DOM 只写解析后的 `data-theme="light|dark"`。协议不提供 density，控件高度固定为 28/32/36px（`radix-nova` 的 `h-7`/`h-8`/`h-9`）；中立 `danger` 只在 UI 实现 投影为 shadcn `destructive`。

`--lumi-theme-neutral` 的默认值是 shadcn 自己的中性灰 `oklch(0.556 0 0)`，且每个混合百分比都按 Oklab 的线性明度推导，使未设种子时的结果精确落在上游值上。根元素的 `font-size` 必须保持 rem 基准（默认 16px），只有 `body` 降到 `text-sm`——否则 shadcn 全部基于 rem 的尺寸会被整体缩放。

`lumi-ui` 将种子投影为 shadcn 语义 Token。组件只消费：

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

UI 实现 可以生成不进入 Schema 的私有派生 Token：

```text
--lumi-ui-control-sm/md/lg
--lumi-ui-tone-*
--lumi-ui-font-*
```

跨层浮层阴影统一使用公共 `--shadow-overlay`，状态色使用公共 `--success`、`--warning`、`--destructive`、`--info`。Admin 不读取 UI 实现 私有派生变量。

Frame 的表面由 `internal/reui/frame.tsx` 自己持有（上游行为），不再从样式表投影 `--lumi-ui-frame-*`；线条一律直接用 `--border`，不再有 strong/soft 两档。

组件结构以 shadcn Radix + Nova 为起点，但 Nova 只提供可维护的组件骨架；最终颜色、线条、层级、密度和圆角必须由本文与 Lumi Token 决定。

禁止：

- HeroUI、Nuxt UI、Prime、Ark 或 ReUI 私有 CSS 变量出现在协议和 Admin 层。
- 组件直接使用固定品牌色。
- 页面自行定义第二套明暗色板。
- 给中性色掺入品牌色偏；未设种子时中性色的 chroma 必须为 0。
- 在 `config/lumi.tailwind.css` 与 UI 实现 的 `@theme inline` 之间使用不一致的 `--radius-*` 阶梯——同一个 `rounded-lg` 在两套 Tailwind 构建里必须解析成同一个值。
- 在 `style.css` 里为控件的 `outline` 外观补写 `border-color` / `background`：这些规则不在 `@layer` 内，会盖掉组件自带的 `focus-visible:` 和 `aria-invalid:` 工具类，等于悄悄关掉聚焦环和错误态。`outline` 就是组件默认外观，不需要任何规则；只有 `filled` 需要覆写，且必须用 `:not(:focus-visible, [aria-invalid="true"])` 把边框让给状态。

**两套 Tailwind 构建的顺序约束。** `lumi-admin` 自带 Tailwind 构建，其样式表在 UI 实现 之后加载，所以它输出的任何**基础**工具类都会盖过 UI 实现 内部"变体压基础"的写法（例如 admin 里写一个 `bg-transparent`，就会让所有 `[data-slot="input"]` 的 `dark:bg-input/30` 失效）。反过来调换加载顺序也不行——那会让 admin 自己的 `md:flex` 输给 UI 实现 的 `hidden`。因此约束是单向的：**Admin 层不得使用 UI 实现 依赖变体覆盖的基础工具类**，需要透明背景时用 `bg-inherit`。`packages/admin/test/shell.test.tsx` 对此有回归断言。

### 2.2 明暗层级关系

采用 shadcn 自己的次序，不再自建阶梯。Dark 模式：

```text
background oklch(0.145)   页面底，最深
  < card / popover / sidebar oklch(0.205)
    < muted / accent / secondary oklch(0.269)   hover、选中、Frame 外框
```

即 `muted` 高于 `card`：卡片相对页面浮起，hover 行相对卡片再浮起。`--border` 与 `--input` 使用半透明白（10% / 15%），跟随身下的表面变化，而不是一条固定灰线。

Admin 是“画布 + 浮动面板”结构：`--lumi-surface-canvas` 是面板背后的画布（浅色为 muted 与 border 的混合，深色为 background）；`--lumi-surface-workspace` 是页面所在的主面板（浅色 background，深色 card）；导航面板使用 `--sidebar`。卡片和弹层保持已有语义。页面不自行生成颜色。

中性色默认种子为 zinc-500（`oklch(0.552 0.016 285.938)`），带极轻冷调。颜色分两种角色：

- `primary`（主按钮）：页面主操作，中性高对比（浅色近黑、深色近白）。Button `appearance="solid"`；分段筛选的选中项、表单步骤也用它。
- `brand`（品牌/强调色，默认 `#2d5bff`，深色向白提亮）：Button `appearance="brand"`，用于需要突出的操作（如“交给 Agent”）；以及选择控件（Checkbox/Radio/Switch/日历选中）、选中行浅底、focus ring、图表首色。Logo 的默认字母方块用 `--info` 底（默认即品牌蓝）+ 白字（`.lumi-brand-mark`）；深色主题 `--info` 被提亮用于文字，方块底压回 L 0.52（同实心 info 徽标），白字仍 ≥4.5:1。配置了 logo 图片时原样显示。

不叫 accent：shadcn 的 `--accent` 是中性 hover 面。主题 `primary` / `brand` / `neutral` 种子各自独立替换。

## 3. 字号、密度与圆角

| Token | 默认 | 用途 |
| --- | --- | --- |
| caption | 12px | Badge、分组标签、时间戳 |
| label | 13px | 按钮、表单标签、Tab、指标标签、辅助信息 |
| body | 14px | 正文、输入、单元格 |
| title | 14px | 卡片/弹窗标题（600） |
| section | 16px | 页面区块、设置分组标题（600） |
| page | 22px | 页面标题（600） |
| metric | 30px | 指标数值（500，字距 -0.025em） |

表头为 caption 与 label 的中间档（12.5px）、500、`muted-foreground`。标题靠字重而不是字号拉开层级。

统一控件高度（`radix-nova` 原值）：

| Size | 高度 | 用途 |
| --- | --- | --- |
| `sm` | 28px | 表格、筛选、紧凑工具栏 |
| `md` | 32px | 默认表单与按钮 |
| `lg` | 36px | 强调操作 |

公共圆角来自同一 `--radius`：默认 7px，`sm` 3 / `md` 5 / 基础 7 / `xl` 12。控件消费 `--lumi-radius-control`（7px），卡片等内容面消费 `--lumi-radius-panel`（10px），Shell 浮动面板与浮层消费 `xl`（12px）。显式主题 radius 种子继续有效；不在页面写死圆角或复制另一套阶梯。

间距统一消费 `--lumi-space-*`：页面留白桌面 space-4 / 移动端左右 space-3；区块间 space-4 或 space-5；表单卡片 space-6 / 辅助栏 space-4，表格单元格 space-2。页面留白不使用 `clamp()`。

### 3.0 Token 角色（2026-11-06 统一）

组件只按**角色**读 token，不直接写尺度值（`h-8`、`rounded-[min(...)]`、`text-[13px]` 一律不再出现在控件上）。公共 token 在 `packages/ui/src/tokens.css`，Tailwind 名称在 `style.css` 的 `@theme inline`，`cn()` 已向 tailwind-merge 注册这些名称。

| 角色 | 公共变量 | Tailwind | 规则 |
| --- | --- | --- | --- |
| 控件高度 | `--lumi-control-xs/sm/md/lg/touch` | `h-control-*` `size-control-*` | 同一尺寸下输入、选择、日期、级联、标签输入、按钮、分页、头像同高 |
| 控件内距 | `--lumi-control-px-xs/sm/md/lg` | `px-inset-*` | 随尺寸取值 |
| 控件字号 | `--lumi-fs-control`（默认 = label 13px，可由 `--lumi-theme-font-control` 覆盖） | `text-control` | 输入值、按钮文字、选项、Tab 一致；表格单元格仍用 body |
| 圆角 | `--lumi-radius-control / -item / -panel / -overlay / -full` | `rounded-control/item/panel/overlay` | 控件各尺寸同一圆角；嵌在有内距容器里的东西（选项、日历格、Tab、Chip）用 item |
| 悬停 | `--lumi-hover-bg/-fg` | `bg-hover` | 选项、行、ghost 控件 |
| 选中（行） | `--lumi-selected-bg/-fg`、`--lumi-selected-range-bg` | `bg-selected` `text-selected-foreground` | 列表里的一行被选中：下拉/级联/时间选项、菜单项、日期、区间端点、表格选中行。只有品牌淡底 + 品牌色文字 + `font-medium`，**不加边框** |
| 选中（选择项） | `--lumi-choice-bg/-fg/-border` | `bg-choice` `border-choice-border`（`CHOICE_CLASS`） | 没有轨道的独立选择：日期预设、筛选 Chip、选择卡片。反色实底：主色填充 + 主色前景（浅色黑底白字、深色白底黑字）；选择卡片面积大，只用主色边框。不用品牌强调色。品牌色只留给聚焦和列表行选中。勾选框、单选、开关本体仍是实心 |
| 选中（轨道项） | `--lumi-segment-bg/-shadow` | — | Tab、分段控件、列表预设：灰色圆角轨道（`muted` + 1px 边 + 3px 内边距），选中项浅色是白色圆角胶囊 + 柔和投影（无边框），深色是亮色反色胶囊（前景色底 + 背景色字），同设计稿 `.seg`；不用品牌色或黑边 |
| 圆角（同心） | `--lumi-radius-item` | `rounded-item` | 有内边距的容器（弹层、下拉、Tab 轨道、分段控件、标签输入、列菜单）重新声明 `--lumi-radius-item = max(radius-sm, 外圆角 − 内边距)`，内部项继承，内外圆角同心 |
| 状态色 | `--lumi-success/warning/info/danger`、`--lumi-text-*` | — | 前者用于填充（进度条、点、标记），后者用于文字。`--lumi-warning` 由 `--warning` 种子提亮成明亮琥珀（同设计稿 `--warning-dot`），填充不得直接读暗色的 `--warning` |
| 聚焦 | `--ring`（= info，默认即品牌蓝；主色保持黑白）、`--lumi-focus-bg` | `border-ring` `bg-focus` `ring-1 ring-inset ring-ring`；触发器用 `FIELD_TRIGGER_CLASS` | 聚焦或展开的字段 = 1.5px 品牌色边（1px 边框 + 0.5px 内描边，不位移）+ 品牌淡底（浅色 8%，即设计稿 brand-soft），**不发光**。聚焦边框 85% 品牌色（深色 90%）|
| 面板间距 | `--lumi-surface-padding`（16）、`--lumi-surface-band`（12）、`--lumi-popover-padding`（12） | `p-(--lumi-surface-padding)` | 卡片、对话框、抽屉共用一个内距；头部/底部条带用 band；Popover 更紧凑 |
| 辅助文字 | `--lumi-fs-meta` | `text-meta` | 字段说明、字段错误、卡片描述都比字段标签（label 13px）小一档 |
| 弹层 | `--lumi-menu-padding`（4）、`--lumi-menu-min-width`（11rem） | `MENU_PANEL_CLASS` / `CONTENT_PANEL_CLASS` | 列表型弹层（下拉、级联列、时间列、行操作、列设置）贴边 4px，行用统一的选项样式；内容型弹层（日历、日期时间）用 popover 内距 12px。菜单里的危险项是红字，不是红底按钮 |
| 条带 | `--lumi-band-height`（48）、`--lumi-tabbar-height`（40） | — | 放一行 md 控件的工具栏/操作条（列表视图、批量条、Frame 头、表单页工具栏、详情/设置页操作条）同高；下划线式 Tab 条同高 |
| 数字字号 | `--lumi-fs-metric`（30）、`--lumi-fs-metric-sm`（24）、`--lumi-fs-micro`（11） | — | 紧凑卡片/统计条的数字用 metric-sm；图表坐标轴、计数角标用 micro |

触屏尺寸只由 `(pointer: coarse)` 触发，不看视口宽度：窄的桌面窗口和内嵌预览仍由鼠标操作，保持桌面尺寸。

主题定制只需覆盖变量：种子 `--lumi-theme-*`（brand、neutral、radius、字号）或任意角色变量。派生变量在 `:root` 和 `[data-theme="light"|"dark"]` 上求值，所以覆盖要写在 `:root` 或带 `data-theme="light"/"dark"` 的元素上，派生值才会跟着重算；写在普通元素上只改它自己读的那个变量。

所有字号消费 `--lumi-fs-caption/label/body/title/section/page/metric`，字重消费 `--lumi-font-weight-*`，控件尺寸消费 `--lumi-control-*`。UI 内部别名与 Admin 的 Tailwind 映射都引用这些公共 token；默认字号、间距与控件尺寸使用 rem，跟随根字号缩放；显式字号种子仍优先。默认值只在 UI 定义，Admin 不读取 `--lumi-ui-*` 私有变量。

一般区块标签为 caption / semibold / uppercase；表单与设置的独立分组采用 `font-section`（默认 16px）/ 600 / sentence case；发布页辅助栏卡片标题用 `font-title`（14px），明确区分分组标题和字段标签。

### 3.1 内容宽度

所有默认页面共用 `LumiPage` 的一个自适应内容轴：宽度为 `min(100%, 1280px)`，在 Shell 可用区域内居中；小屏随容器收缩，页面内边距桌面 16px、移动端左右 12px。列表、仪表盘、卡片列表、普通/发布/分步表单、详情、设置不再各自定义最大宽度。标题、工具栏、Tabs、分割线与正文沿同一轴对齐，嵌套 Page 不重复增加内边距。

宿主可以在 Admin 容器统一设置 `--lumi-admin-content-max-width`；默认页面无需逐页配置。显式 `Page.width="content"` 仅用于独立长文阅读（880px），`full` 用于确需铺满父容器的自定义画布；内置页面不自行启用例外。

表单根据容器而不是视口换列：发布区可用宽度 <680px 时（Assistant 面板打开时编辑页仍保持两栏，与详情页一致） `--lumi-layout-aside` 辅助栏移到主体下方，字段分组宽度 <480px 时单列。设置区 <720px 时说明与控件上下堆叠；图表与表格保持原有内部响应式和横向滚动。

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
- rail、context sidebar、main、assistant 之间不画竖线：各面板自带 1px 边框与 12px 圆角，靠 8px 画布间隙分开。
- Header 底部、Tab strip 底部：单线。
- 表头无底色，上下各一条横线；在结果面内，上方那条由面边缘或 views/批量行承担，不叠第二条。
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
│                  │ page outlet                             │
└──────────────────┴─────────────────────────────────────────┘
```

- Sidebar 与主区都是画布上的浮动面板；菜单可滚动，workspace selector 不随菜单滚走；用户入口与菜单搜索位于 Header。
- 侧栏顶部二选一，由 `app.search: 'sidebar' | 'header' | 'none'` 决定（默认 `sidebar`）：`sidebar` 时顶部是菜单搜索，header 不再有搜索；`header`/`none` 时顶部是工作区块（品牌方块 + 名称 + 说明），`app.workspaces` 有两项以上时它是切换下拉（上下箭头，菜单项 `menuitemradio`，当前项带 info 色勾），切换通过 `createAdmin({ onWorkspaceChange })` 回调，用于 SaaS 切租户/团队/门店。单栏布局没有第一栏，工作区块始终在顶部，`sidebar` 时搜索紧接其下。
- 第一栏（模块栏）当前模块是主色反色方块（浅色黑底白图标、深色白底黑图标）；第一栏与侧栏之间不再叠加框架间隙。Shell 的开关型图标按钮（助手面板）按下时为 info 淡底 + info 色图标（设计稿 `.ibtn.on`），`aria-pressed` 标注。菜单搜索聚焦与字段一致：info 边 + 淡底。
- `createAdmin({ sidebarFooter })` 在菜单底部固定一个宿主插槽（如巡检发现卡片），不随菜单滚动；侧栏折叠时不显示。`menuBadges` 按菜单 name 给出计数，tone 只有 `warning`（需要处理）与 `neutral`（一般计数），右对齐、tabular-nums。
- 菜单分组标题与项目形成明显节奏，不使用等间距列表堆满整列。
- 选中项只使用中性填充面 `sidebar-accent` + `font-medium`，图标不染主色，不加边框、投影或发光。

### 5.2 Dual Shell

```text
 canvas
 rail  ╭ context ──╮ ╭ header ───────────────────╮ ╭ assistant ─╮
 mods  │ workspace │ │ tabs                      │ │ (宿主内容)  │
       │ menu      │ │ page outlet               │ │            │
 theme │           │ │                           │ │            │
 avatar╰───────────╯ ╰───────────────────────────╯ ╰────────────╯
```

- Rail 直接位于画布上，承载模块图标；底部是主题切换与账户头像（菜单向右展开）。当前模块为工作区色底 + 1px 轮廓。
- Context sidebar 展示当前模块的工作区标识（info 字母方块，同 Logo）与分组菜单；不含搜索。
- workspace selector 是普通菜单按钮，没有边框，只有 hover 底色。

### 5.3 Header 与 Tabs

- Header 次序：侧栏开关 → 面包屑 → 菜单搜索（紧跟面包屑，muted 底、⌘K）→ 弹性空白 → 宿主动作 → 竖分隔 → Agent 开关。Dual 的主题与账户在 rail 底部；Single 没有 rail，二者留在 Header 右端。图标按钮采用统一的 32px ghost 样式。
- 菜单搜索过滤的是侧栏菜单，侧栏收起时随之隐藏。
- Tab strip 是路由工作区，不与页面内 Tabs 混用语义。
- Tab strip 使用 line 变体：40px 高，与 strip 底线共用一条 `border-b`（页签 `-mb-px` 压上去），激活项是 `border-foreground` 的 2px 指示条 + `font-medium`，非激活项 `muted-foreground`。不使用 `bg-muted` 分段药丸——路由页签是"我开着哪些页面"，不是一组互斥选项；也不使用主色指示条。
- 关闭按钮常驻 `opacity-70`，hover/focus 提到全不透明。它不能只在 hover 出现：触摸设备没有 hover。
- Tab 过多时横向滚动并提供溢出菜单（`data-testid="admin-tabs-overflow-menu"`），不能压缩到不可读。
- 详情页签读取该路由的标题（包括隐藏菜单路由），动态记录附带标识，例如 `Product detail · 1`；列表与不同记录不能全部显示为同一个 `Products`。标题随当前语言解析，存储只保留路径。

### 5.4 用户入口

Dual 的用户头像位于 rail 底部，Single 位于 Header 右端；菜单提供账户、主题与退出登录。头像旁（上方或左侧）保留一个主题图标按钮，支持 light/dark/system 并显示对应图标，两处主题入口共享状态。

- 菜单宽 240px（`w-60`），`p-1`，普通项 32px。
- 主题是**一行分段控件**，不是三行菜单项：左侧 `Theme` 标签，右侧 `ml-auto` 一条 28px 轨道（`bg-muted`、`p-[3px]`、`rounded-lg`），内含 Light / Dark / System 三个 `menuitemradio`（12px 字号、`px-2`、`rounded-md`）。选中项浅色 `bg-background` + `0 1px 2px oklch(0 0 0/.08)`，深色 `oklch(1 0 0/6%)` 且无阴影。堆成三行要花三行说一件事，而分段控件一眼就同时给出全部选项和当前值。
- Dual Shell：账户入口在 rail 底部，Header 不重复放置。
- Single Shell：账户入口在 Header 右端，sidebar 底部不重复放置退出块。
- Mobile <768px：账户操作可收进移动导航；保留可访问的 light/dark/system 主题入口。
- 路由切换保留 Shell，不显示 `Checking session`；内容加载使用页面级 Skeleton。

### 5.5 Header 右端

Header 右端包含宿主动作区与 Agent 开关（Single 另含主题与账户）。通知等动作由宿主明确提供；Shell 提供位置与统一的图标按钮，不自行发明通知业务。页面周期/筛选等操作仍放在页面内容区，不为了复刻历史稿额外建设 page→header 通道。

### 5.6 Assistant 面板

- 宿主通过 `createAdmin({ assistant })` 提供内容；Shell 只负责右侧面板外框、Header 开关（`admin-assistant-toggle`）与持久化的开合状态（仅在提供了面板时写入 preferences）。未提供时开关与面板都不出现。
- 面板与主区同为浮动面板，宽 `min(24rem, 32vw)`；<1200px 隐藏。
- 交互约定：写数据的建议以确认卡呈现，确认后才执行并提供撤销；纯 UI 状态可直接修改。
- 面板头部是标题 + 模式标签 + 图标按钮（历史、新建、关闭），不用文字按钮；其下是「Viewing <上下文>」条与共享开关，上下文取当前激活 tab 的标签（含记录参数，如 `Order detail · 1`），无 tab 时退回菜单项标签。
- 主操作黑白；只有确认卡上「执行」这一个强调动作用 brand 蓝。

### 5.7 登录页

- 画布（`--lumi-surface-canvas`）上一张居中卡片（宽 ≤980px、`--lumi-radius-xl`、单线边框、无阴影）：左栏表单，右栏品牌面板。品牌面板只用 `--info` 推导的渐变（两端各自钉住明度，浅色 0.48→0.30、深色 0.42→0.24，色相 +20），叠一层渐隐的 32px 网格；白字在两套主题都过 AA。画布有一层淡点阵 + 顶部 info 微光，不引入新色板，不用外部图片。
- 表单栏自上而下：Logo（`.lumi-brand-mark`）+ 应用名 + 副标题 → 「欢迎回来」标题与说明 → 演示账号提示（仅 `login.demo` 配置时出现，muted 底，一键填入）→ 用户名 / 密码（`autocomplete` = `username` / `current-password`，密码框尾部显示/隐藏按钮）→ 「记住我」与「忘记密码？」同一行 → 行内错误 → 满宽主按钮（提交中 loading）→ 底部安全说明。
- 错误分两种：空字段在字段下给出说明并标 `aria-invalid`、焦点移到第一个空字段；凭据被拒在按钮上方显示 danger Alert（常驻 `aria-live` 区域里），两个字段都标 invalid，编辑即清除。连接失败这类瞬时错误走 toast。
- 右上角：语言下拉（`app.locales` ≥2 时出现，复用 Shell 的语言选项）+ 浅色/深色/跟随系统分段控件（radiogroup，方向键切换）。两者在登录前就生效，并写入 Shell 的同一存储（`<storageBase>:preferences` 的 `colorMode`、`<storageBase>:locale`），登录后 Shell 以同样的主题和语言打开；退出登录回到登录页也保持。
- <860px 品牌面板收成卡片顶部的紧凑渐变条（Logo + 名称 + 副标题），版权移到卡片下方；<480px 卡片内距降为 space-5。
- 文案全部走 i18n（`lumi.login.*`）；`login` 配置里的字符串先按自身作为 key 查 messages，所以 JSON 部署也能翻译自定义文案与后端返回的错误信息。

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
- Card 是单层，圆角消费 `--lumi-radius-panel`，表面使用 card，保留 UI 组件自身轮廓。Admin 表单分组和结果面使用单线 border，不重复嵌套 Card；标题与内边距均使用公共 token。
- 标题行右侧的操作或摘要（按钮、分段、头像组）放进头部右侧槽：UI Card 是 `headerEnd`，DashboardCard 是 `action`；与标题 + 描述整体垂直居中，不放进卡片底部。
- 指标卡是 Card，不套 Frame；数值旁的同比用 Badge，不另起一层容器。
- 重要数值不使用无意义 sparkline 装饰；图表必须表达真实趋势或对比。

## 7. 表格与筛选

### 7.1 Table/Data Grid

- Table/DataGrid 使用平铺内容层级和独立表格面；标题/操作/搜索与表格对齐。Frame 按场景选择，禁止强制重复套框。
- 内层表格面使用一条轮廓线和统一圆角。
- 表头 36px 高、12.5px、字重 500、`muted-foreground`；无底色、无圆角，上下各一条横线贯穿表宽，不加竖向列线。
- 状态色 `info` 默认就是品牌蓝（设计稿 `.badge.info` = brand-soft + brand），不再单独一种青色；图表第四色另有 `--lumi-theme-chart-4`。进度条默认实心前景色（黑），品牌色只用于 Agent/信息提示。
- 时间线（两种 marker 同一几何）：16px 标记栏、10px 标记居中于标题行、事件间距 12px；1px 连线从一个标记的中心连到下一个，穿过标记不断开（标记用表面色填充压在线上）。状态只用标记颜色：完成为成功色实心点（其后的连线也染成功色），当前为品牌色圆环加光晕（同步骤条当前态），未开始为空心弱色环，错误红；文字留在无障碍名称里。时间默认在标题行最右（`datePlacement="end"`，弱色、tabular-nums），标题在自己的列内换行，时间不掉行；说明在标题下一行。
- 动态流（ActivityFeed，"谁做了什么"）：左侧 28px 头像，首行一句「**操作者** 动作 **对象**」（名称加粗、动作次级色），时间弱色靠首行右侧；第二行是所属项目等上下文与可选的状态小徽标。行不可点击时没有 hover；状态序列用 Timeline，不用动态流。步骤条：数字圆，当前实心黑，完成为品牌淡底 + 对勾，未开始空心灰数字；已完成段的连线为品牌色。表格加载骨架行与数据行同高（`--lumi-row-height`）。
- 卡片正文只有一个列表（LumiRecordList）时，列表行贯通卡片左右边缘：每行（含首行）一条通栏分隔线，行内边距取卡片内边距，行高 12px 上下留白（同设计稿 `.task`/`.prg`）。
- 数据行 46px 高（容纳 32px 行操作按钮和实体两行文字；`padding-block: 4px`），主要靠横向单线分隔；hover 用 `bg-muted/50`；选中行只用 `primary` 6% 浅底，不加左侧强调线。
- 有选中行时，批量操作行占据 views 行的位置（不叠加底色），表格不发生位移：左侧「N selected」+ outline 批量按钮，右侧 `tone: 'primary'` 的那一个用 brand 蓝，最后是「Clear selection」。批量动作由 `bulkActions` 声明；JSON 里通过 `bulkAction` 事件触发，按下的动作写入绑定的 `activeAction`，选择留在 `selectedKeys`，不在 JSON 里放代码。
- 表格必须放得进 Assistant 面板打开时的主区宽度，不出现横向滚动；长文本列（客户、商品）单行省略并以 `title` 给出全文，金额、时间与行操作列不截断。
- 状态使用 Badge；行操作默认收敛到 DropdownMenu。
- Loading 使用保持列宽的 Skeleton 行；Empty 在表格内说明原因与下一步；Error 提供重试。

**列语义（`TableColumn.kind`）。** `text | badge | entity | date | datetime | currency | actions`。语义决定对齐和格式，页面不再手写 formatter：

- `currency` 默认右对齐、`tabular-nums`、两位小数；`column.currency` 给 ISO 4217 码时按币种格式化，不给就是纯小数。不猜默认币种。
- `date` / `datetime` 用宿主 locale 的 `Intl` 格式化；UI 实现 不引入日期库。
- `actions` 列在页面层被压成无标题、56px、右对齐的一列，操作贴住行尾。

**选择与列配置。** 可选择表格的表头第一列是全选 checkbox，部分选中时 `indeterminate`；空表时禁用。列配置是一个 `menuitemcheckbox` 菜单，落在工具行右端，最后一个可见列锁定不可再关（否则表格会变成空白）。`grid.visibleColumns` 一旦由页面显式给出，列配置菜单让位给它。

**合计行。** 汇总走 `<tfoot>`，不是最后一行数据；`emphasis` 的那条用 `font-semibold`，通过低对比度表面和单线区分。

### 7.2 Filters

筛选分两层，不是一条越来越长的工具栏：

```text
toolbar   搜索 + primary 字段 + [Advanced n] + Reset + toolbarEnd（列配置等宿主插槽）
advanced  展开后的一整行/多行次要字段 + 重置
```

- `schema.primary` 列出的字段进 toolbar，其余进 advanced 面板；**没有 `primary` 时全部字段留在 toolbar**（回退档，避免一个两字段的筛选被折叠进抽屉）。
- 「高级」按钮上带当前生效的 advanced 条件数；面板是行内展开的 `filters-advanced`，不是 `<details>`，也不是 Drawer。
- toolbar 下拉以「muted 标签 + 值」呈现（`Select.labelPrefix`，如 `Status  All ▾`），首项恒为 `All`；「Advanced」紧跟字段之后，`Reset` 推到最右。
- 两层用两档尺寸：toolbar 是 32px 一行（搜索框、下拉、`Advanced`、`Reset` 全部 `md`），面板里一律降到 28px（`sm`）——铺开的选项按钮本来就是 28px，控件跟着它走。
- 高级面板一个字段一行（设计稿 `.frow`）：左侧 84px 字段名，右侧把选项**横向铺开**成 28px 的 `.fopt` 按钮，行首恒为 `All`，选中项 `bg-primary`。行内边距 `6px 0`、列间距 12px、标签 `padding-top: 7px`。
- 面板里**不放下拉**：枚举少（≤ 6 项）就铺开，读者不点开也知道有哪些值。下拉只留给选项多、或需要搜索的字段，且它属于 toolbar（`primary`），不属于面板。
- 范围字段（`dateRange` / `numberRange`）先铺 `All` + 预设按钮，再跟两个 28px 输入框（数字 104px、日期 132px）作为「自定义」尾巴，中间用短横连起来。预设的选中态和枚举同一套。
- 外围工具区中的输入使用 ghost surface；进入独立 Card/Frame 后才使用完整输入轮廓。
- 筛选改变默认即时生效；远程高成本查询允许显式“应用”。两种模式必须由 Schema 明确，不能组件猜测。
- **不做「已生效条件」chip 汇总行**：条件已经在自己那一行里显示为选中的选项，收起时由 `Advanced` 按钮上的数量角标承担，再挂一行 chip 就是同一件事说三遍。
- 单个字段的清除走它那一行行首的 `All`；整组清除走 toolbar 的 `Reset`（无条件时禁用）。
- `toolbarEnd` 可由公开 React API 和 Registry 暴露的原生 named slot 承载；具体可用槽位由 Catalog 声明，JSON 不传 ReactNode。

## 8. 表单与输入

- Field 由 Label、Control、Description、Error 四部分组成；Error 出现不能造成大范围布局跳动。
- 输入默认使用填充面和可辨轮廓；focus-visible 使用 `ring`，invalid 使用 destructive 语义。
- 搜索等外围控件可使用 ghost 样式，但仍有清晰的 hover/focus 边界。
- 可搜索 Select 收起时保持一个标准高度的选择入口，搜索框和选项放在弹层内；清除操作位于控件尾部，不在页面上额外铺一行搜索框。
- MultiSelect 使用同样的紧凑入口，已选值显示为最多两个标签，更多值用数量提示；选项和搜索在弹层内展开。需要始终显示全部选项时使用 CheckboxGroup。单选选择后关闭，多选允许连续选择；保留键盘导航、Escape 关闭和焦点返回，清除操作和选项正确响应禁用、只读、加载状态。
- RadioGroup、CheckboxGroup 的 `direction="row"` 按选项自然宽度横排，空间不足时换行；`column` 才逐项纵排。选项不能因内部 Field 的满宽样式退化为竖列。
- Dialog、Drawer 中的 Select/Popover 必须正确处理 Portal、z-index、滚动和焦点返回。
- 保存状态区分 idle、dirty、saving、success、error；离开 dirty 页面需要明确确认。
- 所有无可见 label 的输入必须有可访问名称。

### 8.1 切换行

一行一个开关的设置项不是 Card，也不是 Field：它是两端对齐的一行——左边标题 + 说明，右边控件，行与行之间单线。给每个开关套一张卡会让"六个无关紧要的选项"看起来像六个重要对象。

## 9. 页面骨架

页面骨架只有五种。新页面必须落到其中一种，不允许每个页面自己排一遍布局。

每页只显示一组必要的标题和主操作，与内容轴对齐，具体容器按页面类型选择。**回到上级的路径由 Shell Header 面包屑承担**，页面不重复绘制；无 Shell 的宿主才自行提供导航。

列表、表单与详情按实际内容决定高度，避免为了对齐屏幕底边而产生大片空白。分页跟随结果面，步骤操作位于独立底栏。`LumiPage stretch` 只供宿主明确需要的自定义画布使用，默认详情不拉伸。

### 9.1 列表页

```text
页面：标题 + 描述 + 页面操作
     ├── stats / kpis 独立统计卡片（可选，互斥）
     ├── 独立筛选卡片：Filters（两层）+ 列配置
     └── 独立结果卡片：保存视图 + DataGrid + 分页
```

- 列表页只保留一组标题、描述和主操作，不依赖 Frame well；工具区与独立表格面保持平铺层级。
- `stats` 仍是同筛选快照的统计，但每个数字独立成卡，位于筛选区域上方；`kpis` 用于更独立的指标，两者互斥，不维护两份远程数据。
- 统计条里的数字默认不带颜色；只有"这个数本身就是问题"的（低库存、逾期）才用 `tone` 上色，配一枚 delta chip 说明它怎么动的——每个数都上色等于没有一个数被强调。
- 紧凑 KPI 卡横向组织标签、数字与必要变化量；不附装饰性火花图。仪表盘指标可突出数字，但不增加无数据意义的图形。
- 批量操作只在有选中行时出现，出现时不能顶开表格。
- 分页位于结果卡片底边：`N total` 在左，`Rows per page` + `‹ 页/总页 ›` 在右；按数据实际高度布局，不拉伸出一大片空表格。
- 表格不是唯一的结果面。`LumiListPage` 的 `results` 槽可以换掉 DataGrid，工具行、统计和分页仍走同一套 chrome：
  - **card-list**：记录是独立对象（项目组合），用卡片网格，列宽 `minmax(240px, 1fr)`。
  - **search-list**：检索页，条件在上、命中卡片竖叠在下；摘要要能读完，所以不用表格。
- 这两种不是新的页面家族，不要另起原型。只有 `results` 不够用时才加新页面构件。

### 9.2 表单页

四种 layout 保留现有交互语义，共用 A 方案的卡片样式。`aside` 可用于任意布局；只放真实辅助信息，不自动编造侧栏。由页面声明，不由字段数量猜：

| layout | 形态 | 保存位置 |
| --- | --- | --- |
| `centered` | 限宽、独立分组卡片 | 页面标题右侧 |
| `tabs` | 标题下方紧凑下划线 Tabs + 分组卡片 | Tabs 同行右侧 |
| `steps` | 独立步骤带、分组卡片和步骤底栏 | 步骤底栏，不重复保存 |
| `publish` | 主体 + 右侧元信息分组卡片 | 页面标题右侧 |

- 页面标题、Tabs、按钮和分组卡片沿同一内容轴对齐；不重复面包屑，也不为已有分组标题的表单添加重复总标题。`formTitle` 仅用于确有独立说明的表单。
- 不在宽卡片里再次缩窄字段区。普通表单沿统一页面内容轴展开，卡片内边距使用 space-6；容器 <640px 时使用 space-5 / space-4，并允许工具栏换行，保留所有操作。
- `tabs` 在可见页面标题下方，导航仅占文字所需宽度、操作位于同行右侧。激活项使用 2px 下划线；错误分组保留红点。
- 步骤带是独立内容面：圆点 + 标题/说明 + 连接线。步骤底栏是另一张轻量内容面，承载 `‹ 上一步 | Step n of m | 跳过 | 下一步 ›`；保留原有步骤校验与提交行为。
- 分组标题使用 `font-section` / 600，说明文字弱化；标题与字段之间留 20px。字段标签行可通过 `LumiFormRow action` 在右侧放置通用操作（建议值的采用/忽略、计数等）。字段默认两栏、容器 <480px 单栏，整行字段显式声明跨栏。不要嵌套卡片或强制空白高度。
- 未保存态：`Unsaved`；保存成功后短暂显示 `Changes saved`，两者都要进 live region。

### 9.3 设置页

设置页使用与其他页面相同的自适应内容轴：页面标题与说明在上，下面是带整行基线的横向 Tabs。Tabs 只占其文字所需宽度，激活态使用 2px 中性色下划线；不用 pill、Card 或第二层侧栏。

2026-09-21 用户确认设置页采用 A「整组卡片」。活动 Tab 内按设置分组纵向排列独立卡片，每组包含标题与说明、字段区、底部操作区；不再使用左侧说明列和跨页面虚线。每个开关仍是卡片内的一行，不为单个字段额外套卡。

卡片使用 `card`、`border`、`--lumi-radius-panel`；内边距 space-6，分组间距 space-5。标题使用 font-section / semibold，说明使用 font-label / muted-foreground。短字段最多两列，宽屏不自动扩展为三列或更多；每列不足 240px 时自动降为一列。长输入及开关组使用单列。容器 <640px 时卡片左右 padding 使用 space-4。

底栏使用单线分隔和轻微 muted 混合表面，左侧是保存状态（`LumiSaveStatus`：干净时成功色「✓ Saved」，有修改时警告点「Unsaved changes.」），仅在有修改、保存中或失败时右侧显示撤销和保存；设置行可带图标（`LumiToggleRow icon`），右侧控件可以是开关、紧凑下拉或带单位后缀的数字输入（`NumberInput suffix`）；小屏允许换行并保留 44px 触控目标。每组操作只影响该组字段，其他组的草稿继续保留；页面离开拦截汇总所有分组的 dirty 状态。普通 content 设置分区使用一张卡，页面级操作仅在底栏显示一次；只读设置不显示保存。

正式示例必须覆盖 Profile、Notifications、Preferences、Security 四个分类，不以占位段落替代设置表单。卡片内的开关行左侧为可点击标题和说明、右侧为开关，相邻行用细线分隔；小屏允许说明换行，但开关保持右侧且不压缩。示例包含通知渠道、业务提醒、地区下拉选项、工作区偏好、安全提醒，并通过 mock 保存和回填各组字段；业务通知发送和全局偏好应用由实际宿主接入。

### 9.4 详情页

`1fr + 320px`。主体是"这个对象是什么"（属性带 + 行项目表 + 长内容分区），右栏是"关于它的元信息"（归属、Activity 时间线）。属性带用 `repeat(auto-fit, minmax(150px, 1fr))` 自动降列。行项目（订单行、发票行……）是一个走 `fill` 内板的表格，不是描述列表。

- 页面标题、状态徽标与操作使用统一 PageHeader，下面是独立属性、内容和活动卡片；不套 Frame 外框。卡片使用 `card` 表面、单线边框与 space-4 间距。
- 长内容（描述、备注）用主栏的 `sections` 分区，不塞进 320px 右栏——右栏是拿来扫的，不是拿来读的。
- 两栏顶部对齐，各分区按内容自然结束，不强制同高、不填满剩余视口。可用内容宽度 <680px 时右栏移到主体下方（Assistant 面板打开时详情仍保持两栏）；无辅助内容时主体占满。字段换行不带孤立竖分隔线；主体分区标题使用 sentence case / font-section，辅助栏使用 font-title。
- 320px 右栏里的时间线是"发生了什么 → 什么时候"的纵向阅读：用 `datePlacement="below"`，时间戳在标题下一行，窄列里不与标题同排挤压。其他位置默认 `end`：时间独占一列放在标题行末，长标题只在自己的列内换行，同一列不会出现两种形状（上游 flex-wrap 写法的问题）。

### 9.5 仪表盘

仪表盘遵守统一 1280px 页面上限，在 Shell 可用区域内居中并随容器收缩；标题、周期操作、指标与分析区域保持同一对齐轴，不重复页面面包屑。默认只保留收入、订单、客户三项核心指标，再接一张全宽每日趋势（`LumiMatrixChart` 点阵：每天一列固定点位按值填充，系列图例切换收入/订单，异常日用 warning 列与带注释的 callout 标出）和近期订单表；页面操作只有周期分段（7 / 28 / 90 天）与导出，不放刷新按钮。近期订单里需要处理的行（如超时未发货）用 warning 状态徽标并带 brand 色「Agent」标记，与 Assistant 面板的说法一致；不在首页堆放订单分布、支付构成和客户排名，不提供仅改变图表外观的切换按钮。指标按可用宽度自动换列，趋势与订单表沿同一轴排列，明细表在自己的区域内横向滚动。表单、详情与仪表盘使用相同页面宽度，内部按内容组织分栏。

通用 Dashboard 内容面最多两列，列宽均分可用空间，间距使用 space-4；容器 <760px 时单列。全宽区块显式跨列，各卡片按内容自然结束，避免固定列宽留下未使用的页面区域。指标区独立按指标数量和可用宽度排布。

Workbench 聚焦当前工作：顶部是四张全宽快捷操作卡（muted 图标块 + 标题 + 一行说明），下面左列是待办（checkbox + 标题 + 说明 + 右侧状态 pill，完成项划线），右列是项目进度（细进度条，落后用 warning）与近期动态时间线，沿用通用 Dashboard 的两列/单列布局。经营 KPI 留在 Dashboard，工作台不重复展示；项目名称、负责人和进度各有明确位置，名称可换行，不挤成省略号。项目与动态分别请求、分别展示加载、失败、空状态与重试。

图表通过 UI 的可选入口集成 VChart；迁移后组件定义归 `lumi-ui/catalog`，React 图表实现与引擎按需加载，通过原生 Registry 注册。现有引擎版本按锁文件验证，不因改渲染层无故升级。原生 VChart spec 留在 UI 内部。支持面积、折线、横向条形、环形图，所有数值提供可展开的语义数据表；空数据与加载失败不能显示虚假图形。主题使用公开 `--chart-1…5`、`--card`、`--border` 等变量，切换主题后重绘，尺寸改变时 resize，离开页面时 release。

画布尺寸始终等于宿主的实际宽高；主题切换重建实例时也立即应用当前尺寸，不能等待下一次容器变化才修正。Lumi 保持宿主定位并统一观察尺寸，避免引擎覆盖布局或另起自适应监听后回落到默认画布高度。验收同时覆盖深浅主题切换、窗口变宽/变窄和容器高度变化。

引擎在首次挂载图表时加载，基础 UI 实现 入口不导入 charts；独立引擎 chunk 另设命名体积预算，原有基础 UI / Admin 首包上限保持不变。仪表盘示例仅使用当前 mock 的真实订单汇总：7 / 28 天影响所有交易指标、趋势与近期订单；收入仅统计 paid / packed / shipped，无历史时不编造同比。

### 9.6 示例与组件演示

示例页沿用公共 1280px 内容轴、页面标题、字号与间距，不在页面外再套 Frame。组件示例使用独立卡片，宽屏双列、窄屏单列；不同高度的卡片按瀑布流排列，列内和列间都使用 space-5（默认 20px），不以同排最高卡片强制留下空白。标题与导航之间只保留一份间距。

瀑布流保留原始 DOM 和键盘顺序，宽度变化、内容变化和源码展开只重新计算布局，不重新挂载控件或重建 native StateStore；输入值、选中状态与焦点继续保留。区块导航可直接跳转，提供明确的重置操作与实际 native Spec 源码。

输入变体在卡片内自适应排列，用轻量可见标签区分 Default、Searchable、Loading、Disabled、Horizontal、Vertical 等状态，不把全部短输入纵向拉满整页。标签沿用 font-caption / muted-foreground，控件具有唯一、明确的可访问名称；变体继续使用已有 Catalog 组件和原生状态绑定。

示例菜单同时提供可搜索的工作流目录与组件目录。表单按基础、分步、发布、页签区分；列表与详情提供清晰的类型入口。覆盖层必须有打开/关闭入口，页签必须有切换内容，不以不可见的组件定义冒充演示。当前覆盖与同类产品差距见 [示例完整性评估](../tasks/demo-completeness-2026-09-21.md)。

## 10. 覆盖层

Dialog 与 Drawer 都是三段式：**header / body / footer，只有 body 滚动**。长内容把「保存」推出视口是覆盖层最典型的失败。

```text
header  标题 + 描述（常驻）
body    data-slot="lumi-overlay-body"，overflow-y-auto
footer  footerStart 靠左（未保存标记等），主按钮在最右（常驻）
```

- Dialog 内板是 grid，用 `grid-template-rows: auto minmax(0, 1fr) auto` + `max-height: min(85vh, 48rem)` 建立三段；Drawer 是 flex 列，body 取 `flex-1`。这条规则写在 `packages/ui/src/style.css`，不改上游 hash-locked 组件。
- footer 里取消在前、确认在后，右对齐后主按钮自然落在最右。
- `footerStart` / `footerEnd` 由公开 React API 和原生 Registry slots 提供。`footerEnd` 给出时整组替换默认确认/取消，用于“应用筛选”等场景；JSON 中的可用槽位由 Catalog 明确声明。
- `DrawerProps.size` 的 `sm / md / lg` = **384 / 480 / 720px**：一个短表单、一个完整表单、一个需要列的表格。横向 Drawer 同时受 `min(90vw, size)` 约束。`DialogProps.size` 的 `sm / md / lg / xl` 是宽度区间 **288–384 / 384–512 / 504–672 / 672–896px**（下限 = 上限 × 3/4）：`width: max-content` 在区间内随内容收放，长文字到上限换行，并受 `calc(100% - 2rem)` 约束；正文含表单、表格或 `data-lumi-fill` 时直接取上限，避免字段缩到占位宽度、数据到达时弹窗变宽。
- 没有正文（只有标题、说明和按钮）的 Dialog 是确认框：`data-layout="confirm"`，一个 20px 内距的紧凑块（标题 → 说明 → 右对齐按钮），无滚动正文、无 footer 分隔线、无右上角关闭图标（Esc 与取消按钮即出口）；未指定 size 时宽 336–448px。删除、放弃修改等不可撤销操作用 `tone=danger`，确认按钮为 destructive，取消为 outline，初始焦点落在取消上。
- 覆盖层里的表单沿用页面表单的分区：`ui-sect-h` 区块标题 + 两栏栅格，不因为在抽屉里就换一套排版。
- 覆盖层里放表格时，body 用 `data-lumi-fill` 取消自身内边距，让行铺到抽屉边缘——行自带 gutter，body 再补一层就是双重留白。这与 Frame 内板用的是同一个中性开关。
- Drawer 只从 `side` 指定的一侧进出；关闭后焦点回到触发器（见 §13）。
- demo 的落点（设计稿 `#mk-modal` / `#mk-drawerform` / `#mk-drawertable`）：
  - **Modal** 不进路由。Articles 的「New category」是短表单（Name / Parent / Slug，`size=md`）；行上的 Unpublish 是 `tone=danger` 的确认。
  - **Drawer 表单** 走 `?drawer=edit-customer&record=`，480px（`size=md`），列表留在后面；脏关闭走统一 dirty guard。
  - **Drawer 表格** 走 `?drawer=customer-orders&record=`，720px（`size=lg`），body 用 `data-lumi-fill` 让行顶到抽屉边。它只提供搜索 + 一个状态快筛 + 分页，没有完整 Filters / 列配置 / 批量。
- 宿主可以通过 Admin 的抽屉上下文改变标题与 footer；JSON 通过已声明的原生 slots 组合内容，不保留旧 LumiContractSlots 接口。
- 与 `#mk-*` 同时取 rect 后对齐的数：遮罩 `oklch(0 0 0 / .5)`（不是上游的 10% + blur）；Dialog 圆角 `--lumi-radius-overlay`（默认 10px）；header 16 / title-desc 间距 4 / footer 12×16，footer 不涂 muted；侧抽屉圆角 0；表抽屉工具行 `0 20px 12px`（高 44，不是 56）。Drawer 头 79、脚 57 与设计稿同高。

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
- **徽标三种外观只靠颜色区分（2026-11-07）。** Badge 与 Tag 共用 `style.css` 里同一组 `:is([data-slot="badge"], [data-slot="tag"])` 外观规则，尺寸、圆角、字号 12px、字重 500 与圆点完全一致。实心：浅色就是种子色 + 白字；深色不再用提亮后的 tone 配黑字（霓虹感），而是钉 L 0.52、chroma 取该 tone 的软标签值（`min(c, --lumi-ui-tone-text-c)`，绿色不出 sRGB）+ 白字，任意 hue 白字 ≥4.6:1；neutral 两套主题都是 L 0.42 的深灰 + 白字（不是浅灰块）；primary 保持反色对（浅色近黑、深色近白，同主按钮）；warning 是浅琥珀 + 深棕字。描边：文字与圆点用软标签的 tone 色，边框为 tone 以 40% 混入 `--border`，底透明。primary 的软/描边文字用 primary 本色，与灰字的 neutral 区分开。
- **Danger 按钮走填充面，不用 10% 淡底。** 上游 `destructive` 是 `text-destructive` 落在 `bg-destructive/10` 上，默认种子下对比约 4:1，过不了 AA。`appearance=danger` 改用 `--destructive` / `--destructive-foreground` 这一对（浅色白字、深色黑字）。
- Dark 模式单独验收，不能沿用 Light 模式通过结果。

## 14. 视觉验收清单

每次 Shell、Token 或基础组件改动至少检查：

- Single/Dual × Light/Dark。
- 1440px、1024px、390px。
- 未设主题种子时，中性 Token 与 shadcn neutral 逐值一致，chroma 为 0。
- 根元素 `font-size` 是 16px；按钮/输入默认 32px 高、控件与普通内容面默认 6px 圆角；修改全局字号、圆角种子与间距 token 后，UI 和 Admin 必须一起响应。
- workspace selector 无边框、无阴影，只有 hover 底色。
- 导航分组之间没有分割线；选中项只有中性填充面和 `font-medium`，图标不染主色。
- 使用 Frame 时检查其 3px 包覆与表面；普通列表/表格保持平铺，不被强制套框。
- Table header 保留低对比度底色与圆角；row separator、search ghost、pagination 属于正确层级。
- 路由切换无 session 文案闪烁，无页面 remount。
- 键盘、焦点、Portal、滚动和 reduced motion 正常。

ReUI Pro 预览只允许在官网浏览器中外部查看；不得下载或提交预览截图、源码、图标和模板，也不得把它们用作视觉回归基线。所有仓库内验收截图必须由 Lumi 原创实现生成。
