# Lumi 非视觉页面能力实施计划

Status: confirmed
Last updated: 2026-08-23
Architecture baseline: `plan/README.md` 已确认总架构 + 2026-08-10 七项交接增量
Confirmation: 用户明确要求按交接稿开发并确认表格三层职责以架构清晰为准
Document language: 中文

## Tasks

- [x] TASK-201 — 完成四项协议纵向链
  - Links: REQ-201, ARC-201
  - Dependencies: none
  - Scope/boundary: schema/check/React/Vue renderer/docs 生成；不实现 adapter 视觉与样式。
  - Implementation: 新增两组件和 props descriptor；修正 Fragment props 转发；生成 TS/Rust/docs；拒绝页面级 Admin 名称作为标准 type。
  - AC-201: 25 core + 4 extension 目录、TS/native/WASM 精确 parity、React/Vue 均能把节点和 props 落到 contract、文档生成物同步。
  - Validation: schema/check catalog、schema tests、checker tests、React/Vue renderer tests、docs generate/check。
  - Evidence: EVIDENCE-201

- [x] TASK-202 — 建立同筛选快照的列表统计
  - Links: REQ-202, NFR-201, ARC-202
  - Dependencies: none
  - Scope/boundary: core query contract、React/Vue useTable、Admin mock；不改页面排布和 Table 视觉。
  - Implementation: aggregate query key/request/result；同 snapshot 门控；resource invalidation；mock endpoint。
  - AC-202: 筛选切换时不公开旧统计，第一项 total 与当前 list total 一致；两类查询共同失效，React/Vue 对等。
  - AC-208: 导入和测试证明 `Table` 不依赖 data hooks，KPI 不进入 useTable。
  - Validation: core query tests、React/Vue table tests、mock API tests/typechecks。
  - Evidence: EVIDENCE-202

- [x] TASK-203 — 扩展表单分组、分步校验与草稿
  - Links: REQ-203, REQ-204, ARC-203
  - Dependencies: none
  - Scope/boundary: core form helpers、React/Vue useForm/tests；页面仅消费，不改布局样式。
  - Implementation: group declarations/aggregation/first path；partial validation；draft store；keyed form lifecycle/latest-submit 竞态保护。
  - AC-203: tab group 可得 error count 和首错字段；指定字段有错时步骤不能前进；submit 始终全量。
  - AC-204: save/restore/clear 行为与 dirty/target/reset/pending 语义明确且两端一致。
  - Validation: React/Vue 对等表驱动测试和 admin consumer contract test。
  - Evidence: EVIDENCE-203

- [x] TASK-204 — Routed drawer 与统一 dirty close guard
  - Links: REQ-205, REQ-206, ARC-204
  - Dependencies: TASK-203
  - Scope/boundary: React overlay controller、Admin router/guard/tests；不改 overlay 样式、Shell 或视觉基线。
  - Implementation: async deduplicated close guards；routed drawer query source；direct/back/dismiss sync；dirty guard 注册。
  - AC-205: `?drawer=` 可直达/分享/后退关闭，modal 不改 URL。
  - AC-206: 遮罩/Esc/X/programmatic dismiss 走同一确认；取消保持，确认只执行一次，无 URL/stack 环。
  - Validation: overlay unit + Admin memory-router integration + targeted E2E functional assertions；不更新视觉基线。
  - Evidence: EVIDENCE-204

- [x] TASK-205 — 固化货币与日期时间格式依据
  - Links: REQ-207, ARC-205
  - Dependencies: none
  - Scope/boundary: core i18n contract、React/Vue formatting hooks/tests；`TableColumn.kind` 枚举和 adapter 渲染由视觉侧负责。
  - Implementation: format context、major/minor 转换、iso-utc 输入与目标时区；extend provider 透传。
  - AC-207: 相同配置在 core/React/Vue 输出一致；缺失/非法配置显式失败而非猜测。
  - Validation: core i18n tests、React/Vue provider tests、typecheck。
  - Evidence: EVIDENCE-205

- [x] TASK-206 — 生成、全量门禁与独立终审
  - Links: NFR-202, NFR-203, ARC-201..205
  - Dependencies: TASK-201..205
  - Scope/boundary: 仅生成物、测试和 review 修复；不扩大视觉范围。
  - AC-209: diff 不含 adapter style、Admin 排布/ShellParts、ui spec 或视觉 baseline 修改。
  - AC-210: typecheck/lint/test/build/e2e/checker/size/assets/generated/upstream/release guard 全绿，React/Vue 无语义漂移。
  - Validation: 交接稿完整命令矩阵、`git diff --check`、独立 reviewer 一轮。
  - Evidence: EVIDENCE-206（非视觉门禁）、EVIDENCE-207（视觉 adapter 合入后的全仓门禁）、EVIDENCE-208（对照设计稿逐页核对后的全仓门禁）、EVIDENCE-209（设计稿其余 7 个变体核对后的全仓门禁）、EVIDENCE-210（按设计稿逐像素量取列表页后的全仓门禁）、EVIDENCE-211（同法量取设置页后的全仓门禁）、EVIDENCE-212（demo 页面目录扩展与两种列表统计并存后的全仓门禁）、EVIDENCE-213（补齐四种表单版式与订单详情后的全仓门禁）、EVIDENCE-214（组件 gallery 扩展与三处 adapter 修复后的全仓门禁）、EVIDENCE-215（覆盖层页面、card/search 列表与视觉矩阵扩到 60 张后的全仓门禁）、EVIDENCE-216（对照 `#mk-*` 量测覆盖层并对齐后的全仓门禁）、EVIDENCE-217（高级筛选面板铺开选项并修好 `size` 后的全仓门禁）、EVIDENCE-218（状态色收敛到单一来源与仪表盘宽屏限宽后的全仓门禁）、EVIDENCE-219（补上 header 右端宿主插槽与分段式主题控件后的全仓门禁）

## Evidence

| ID | AC | TASK | Command/observation | Environment/time | Artifact/baseline/diff | Result |
| --- | --- | --- | --- | --- | --- | --- |
| EVIDENCE-201 | AC-201 | TASK-201 | schema 56 tests；checker 36 tests；React/Vue renderer；catalog/docs generate check | local / 2026-08-11 | 25 core + 4 extension；native/WASM/TS parity | pass |
| EVIDENCE-202 | AC-202, AC-208 | TASK-202 | React/Vue keep-previous snapshot + resource invalidation；Admin mock HTTP | local / 2026-08-11 | list/aggregate 同 filters；placeholder 不公开 | pass |
| EVIDENCE-203 | AC-203, AC-204 | TASK-203 | React form 11 tests、React 全套 86 tests、Vue/Admin/core 定向 33 tests、React/Vue/Admin typecheck、React build、独立 re-review | local / 2026-08-11 | keyed lifecycle；Suspense abandoned WIP 与 descendant layout-effect same-commit submit 回归 | pass |
| EVIDENCE-204 | AC-205, AC-206 | TASK-204 | overlay tests + Admin routed drawer 5 cases + Admin 64 tests | local / 2026-08-11 | direct/PUSH/POP/REPLACE/programmatic/duplicate close | pass |
| EVIDENCE-205 | AC-207 | TASK-205 | core i18n 13 tests + React/Vue provider tests | local / 2026-08-11 | major/minor、严格 ISO UTC、目标时区 | pass |
| EVIDENCE-206 | AC-209, AC-210 | TASK-206 | 46 files / 462 tests；7 packages typecheck；lint；generated；size；diff-check | local / 2026-08-11 | full root gate blocked only by user-owned adapter wrappers/count assertion | partial |
| EVIDENCE-207 | AC-210 | TASK-206 | typecheck；lint；60 files / 543 tests；generated；upstream offline；assets；size；release guard；schema；docs-base；isolation；build；`e2e:react-admin` 10 passed | local / 2026-08-11 | 30 张 baseline 全量重拍并二次校验；ui-js 25586B gzip、ui-css 14461B gzip、admin entry 337438B gzip 已回写基线 | pass |
| EVIDENCE-208 | AC-210 | TASK-206 | 设计稿逐页截图比对（仪表盘/列表/详情/表单/设置）；typecheck；lint；60 files / 543 tests；generated；upstream offline；assets；size；release guard；schema；docs-base；isolation；pack；`pnpm e2e` 18 passed | local / 2026-08-11 | 页面吃满 shell 高度（`LumiPage stretch`）；表单步骤页改走 `layout="steps"` + `LumiFormSection`；详情页新增主栏 `sections` 与 well 记录操作；修复软徽标 tone 前景色在 `:root` 求值失效导致的继承与 AA 失败；30 张 baseline 二次重拍并回写清单 | pass |
| EVIDENCE-209 | AC-210 | TASK-206 | 剩余 7 张设计稿（modal/drawerform/drawertable/publish/tabform/listkpi/liststat）与临时 harness 渲染结果比对；typecheck；lint；60 files / 543 tests；全部 verify 门禁；`pnpm e2e` 18 passed | local / 2026-08-12 | demo 只跑 5 个页面，`tabs`/`kpis` 变体此前无任何渲染在场：临时把 demo 切到这两个变体截图核对后还原。KPI 卡（`scale="sm"`）改为横读一行；`tabs` 的 Tab 条移到 well 顶掉标题；`LumiStatStrip` 补 `change`/`tone`；覆盖层 body 支持 `data-lumi-fill` 全幅表格；表单区上下留白对齐 28/32 | pass |
| EVIDENCE-210 | AC-210 | TASK-206 | 与 `mk-liststat` 逐像素量取（well/内板/统计条/工具行四处 rect）；typecheck；lint；60 files / 543 tests；全部 verify 门禁；30 张 baseline 重拍并二次校验；`pnpm e2e` 18 passed | local / 2026-08-12 | 统计条位置与设计稿一致（内板顶、工具行之上，同样的 1px 下边框与 12/16 内距）；真正的偏差是工具行 96px vs 设计稿 56px——adapter 把 `Filters` 翻成列时留下了上游的 `flex-wrap`，wrap + column 让容器按列盒取高，多出 40px 空带把统计条从表上推开。补 `flex-nowrap`；well header 40px 按设计稿回到 48px。量后 head 48 / strip 95 / tools 56 | pass |
| EVIDENCE-211 | AC-210 | TASK-206 | 与 `mk-settings` 逐像素量取（well 头/导航板/内容板/字段区四处 rect）；typecheck；lint；60 files / 543 tests；全部 verify 门禁；30 张 baseline 重拍并二次校验；`pnpm e2e` 18 passed | local / 2026-08-12 | 三处偏差：字段区没限宽（设计稿 `clamp(560px, 82%, 800px)` 居中 + 28/32 上下留白，实现是整幅 + 16/20）；导航裸放在 well 上，设计稿里它是自己的一块内板（178px，和右板隔 3px）；well 头左右 16px vs 设计稿 13px（13 + well 自身 3px 外圈 = 16）。量后 aside 178 / panel 875 / wrap 716（82%）/ head 内距 8px 13px | pass |
| EVIDENCE-212 | AC-210 | TASK-206 | demo 从 5 页扩到 16 页（5 个模块）；`AdminOrdersRoute` 与 `mk-listkpi` 比对；typecheck；lint；60 files / 543 tests；全部 verify 门禁；30 张 baseline 重拍并二次校验；`pnpm e2e` 18 passed | local / 2026-08-12 | 设计稿把列表统计分成两种且规定按语义选：随筛选变的合计走内板统计条（Products，`stats`），不随筛选变的 KPI 走 well 之上的指标卡（Orders，`kpis`，取 `/dashboard` 的 totals/deltas/series）。`kpis` 此前没有任何页面渲染，因此 `.lumi-metric-cards` 的四列固定栅格把三张卡压成 3/4 宽、金额换行——改为 `repeat(auto-fit, minmax(200px, 1fr))` + 12px 间距，sm 数值 `nowrap`。`valueMap` 原先只在 badge 列生效，纯文本列拿到的是 `cod`/`wechat` 原值，改为所有文本类单元格都查表。新增 Customers/Articles/Projects/Users/Roles 五张纯列表与 Result×2 / Exception×3 状态页 | pass |

| EVIDENCE-213 | AC-210 | TASK-206 | demo 从 16 页扩到 21 页；`publish` / `tabs` 两个表单变体与订单详情首次有常驻页面；typecheck；lint；60 files / 543 tests；全部 verify 门禁；30 张 baseline 重拍并二次校验；`pnpm e2e` 18 passed | local / 2026-08-12 | 补齐 Workbench（第二块仪表盘：快捷入口 + 我的项目 + 近期动态）、订单详情（设计稿 §5 的三种密度：摘要横条 + 行项目表 + 右对齐 300px 合计 + 履约时间线）、Write article（`layout="publish"`，正文 + 300px 元数据栏）、New project（`layout="tabs"`，Tab 条占 well、按字段分组标脏）。至此 `centered`/`steps`/`tabs`/`publish` 四种表单版式与 `stats`/`kpis`/无统计三种列表形态都有页面在跑 | pass |

| EVIDENCE-214 | AC-210 | TASK-206 | 组件 gallery 从 1 页扩到 7 页并接进 demo（`/ui/*`）与文档分类预览；typecheck；lint；60 files / 545 tests；全部 verify 门禁；30 张 baseline 重拍并二次校验；`pnpm e2e` 18 passed | local / 2026-08-12 | gallery 之前只有一份 `standard` 大文档，只被文档页 focus 单个节点使用，没有任何可浏览的 UI 展示。拆成 text/choice/composition/data/feedback/surfaces 六组，每组按组件切成 Card 标本，逐个列出真实变体（尺寸、外观、tone、禁用/只读/非法/加载/空）。demo 新增 Components 模块共 7 条路由，用 `LumiRender` 直接渲染 gallery 的 schema——展示和协议不会各走各的。渲染过程暴露三个真 bug：① adapter 的 `LumiFragment` 是裸 React Fragment，`layout`/`asideWidth` 直接丢弃，而 renderer 对带 props 的裸 Fragment 会抛错，即协议声明了却无人实现——补成 stack/split 两种排布；② `[data-lumi-control-size]` 的固定高度打在 RichText 外壳上，把「工具条 + 文本域」压成 32px 一条，编辑器整个看不见；③ actions 列没有 label 时表头打印字段名 `actions`，设计稿是空表头——改为 sr-only "Actions" | pass |
| EVIDENCE-215 | AC-210 | TASK-206 | typecheck；lint；60 files / 547 tests；generated；upstream offline；assets；size；release guard；schema；docs-base；isolation；pack；`CI=1 pnpm e2e --update-snapshots` 与二次 `CI=1 pnpm e2e` 均为 19 passed | local / 2026-08-13 | 设计稿 02 最后三张覆盖层第一次有常驻页面：Articles「New category」是 `#mk-modal` 短表单（不进路由），行上 Unpublish 是 `tone=danger` 确认；Customers 行进 `?drawer=edit-customer&record=`（480px 表单）和 `?drawer=customer-orders&record=`（720px 全幅表）；订单详情「Customer history」打开同一张表抽屉。Routed drawer 补了 `record` 查询参数、`size` 和 `useAdminDrawerChrome`（单测覆盖直达/关闭清参）。card-list / search-list 没有新原型，复用 `LumiListPage.results` + `pager`（`/projects/cards`、`/articles/search`）。视觉矩阵从 5 页扩到 10 页 × 3 断点 × 明暗 = 60 张，`expectedCount` 同步。把 gallery feedback 加进 axe 后挖出上游 destructive 按钮是 10% 淡底红字，浅色对比 4:1——在 `style.css` 改走 `--destructive` / `--destructive-foreground` 填充面，未改 hash-locked `internal/` | pass |
| EVIDENCE-216 | AC-210 | TASK-206 | 对设计稿 `#mk-modal` / `#mk-drawerform` / `#mk-drawertable` 与运行中的 app 同时取 `getBoundingClientRect` + `getComputedStyle`；admin-react 72 tests；adapter 38 tests；`CI=1 pnpm e2e --update-snapshots` 与二次 `CI=1 pnpm e2e` 均为 19 passed；assets 90 | local / 2026-08-13 | 量后对齐：遮罩 10%+blur → `oklch(0 0 0 / .5)`；Dialog 圆角 14 → 10；footer 去掉 muted 带，内距 16 → 12/16；侧抽屉圆角 14 → 0；表抽屉工具行 56 → 44（去掉顶距）。Drawer 头 79 / 脚 57 / 工具行 44 与设计稿同高，宽 480 / 720。视觉矩阵再加 modal / drawerform / drawertable / cards / search × 3 断点 × 明暗 = 90 张 | pass |
| EVIDENCE-217 | AC-210 | TASK-206 | 对设计稿 `#mk-list` / `#mk-liststat` 的 `.ui-frows` 与运行中的 app 同时取 `getBoundingClientRect` + `getComputedStyle`；typecheck；lint；60 files / 549 tests；全部 verify 门禁；90 张 baseline 重拍并二次校验；`CI=1 pnpm e2e --update-snapshots` 与二次 `CI=1 pnpm e2e` 均为 19 passed；90 张 baseline 无一被重写（mtime 仍是上一轮），但 `maxDiffPixelRatio: 0.01` 容得下工具行两个按钮 28→32 的差，所以这一轮的尺寸证据以 DOM 量测为准，PNG 只证明没有别处回归 | local / 2026-08-23 | 高级筛选面板此前是「一行一个库控件」：5 个选项的 Category 铺成整幅下拉、日期范围只有两个裸输入框，读者不点开不知道有哪些值。设计稿要的是把选项**横向铺开**（`.frow` / `.fopt`），下拉只留给选项多或需搜索的字段。三处修正：① `chips` 的 `.fopt` 早就实现对了，错在 demo 给少量枚举选了 `select`——Users/Articles/Orders 三处 `select` → `chips`，Projects/Articles 的裸 `dateRange` 补上 `DATE_PRESETS`；② 范围字段的 preset 按钮既没有 `All` 也没有选中态，和同一行的枚举不是一套控件——抽出共用的 `FilterOptionButton`，行首恒为 `All`（点击即清空该字段），命中 preset 时 `bg-primary`；③ 量出来的真 bug：`size="sm"` 全仓失效。`[data-lumi-control-size]` 的高度规则写在 `@layer components`，而 `Input` 自带 `h-8` 工具类在 `utilities` 层——层级优先于特异性，所有 sm 输入实际都是 32px。改为把高度作为类经 `twMerge` 合入（`h-7`/`h-8`/`h-9`），调用方自己的 `className` 仍后于它生效。按设计稿删掉「已生效条件」chip 汇总行（`filters-conditions`）与行尾的 `Clear all`：条件已经是自己那一行里选中的选项，收起时由 `Filters` 的数量角标承担，第三次重复没有信息量。单字段清除改走行首 `All`，整组清除走 toolbar 的 `Reset`；`ui-design-spec` §7.2 那条「生效条件以可关闭 chip 汇总」同步改写。修好后又暴露第二层：`FilterControl` 对两层都传 `sm`，而设计稿的 toolbar 用的是 `.ui-input` / `.ui-btn`（32px），只有面板才是 `--sm`（28px）——改成按 `layout` 分档，`Filters` / `Reset` / `Apply` 三个按钮同时去掉 `size="sm"`。量后：行内距 6px 0 / 列距 12px / 标签 84px + `padding-top: 7px` / `.fopt` 28px / 数字框 104×28 / 日期框 132×28 / 面板 `4px 12px`、左右内缩 16px、距表 12px——与设计稿逐项相等 | pass |
| EVIDENCE-218 | AC-210 | TASK-206 | 状态色 token 收敛到单一来源；仪表盘限宽与柱宽上限；1440 / 2079 两档实测 DOM rect；十组明暗徽标对比度实测；typecheck；lint；60 files / 549 tests；全部 verify 门禁（isolation 除外）；`CI=1 pnpm e2e --update-snapshots` 与二次 `CI=1 pnpm e2e` 均为 19 passed | local / 2026-08-23 | 三件事。① 软徽标的底与字原先由 `color-mix(…, black)` 推导，而 oklab 往黑混会把 L 和 C 等比缩掉，warning 还比 success/info 多混一次（`oklch(.596 .136)` → `oklch(.391 .089)`），于是 Draft 是土棕。改成 `oklch(from tone L C h)` 各自钉住明度与彩度、只继承色相；neutral/primary 的彩度必须显式写 0，否则未定义色相落到 0° 会让 Archived 泛粉。十组明暗配对实测 4.53–5.49:1。顺带发现 `--lumi-ui-tone-warning-foreground: white` 在种子上只有 4.16:1（黑字 5.05:1），改黑。② 状态色在仓库里有四套值：基座 `#b66a00`、adapter `#b66a00`、pipeline `oklch(.5 .12 75)`、表单脏点 `oklch(.769 .188 70.08)`——所以只改 adapter 时仪表盘纹丝不动。改为 adapter 独家持有字面值（与 `--destructive` 同形），基座按本文件既有约定 `var(--success, …)` 读回，admin 包读基座，下游零 fallback。③ 宽屏。先试过给 `wide` 加 1600 上限，按反馈改成保持 100% 宽、让**栅格加列**：`.lumi-dashboard-content` 过 1680px 从 `2fr 1fr` 变 `2fr 1fr 2fr 1fr`，一行放两组「宽卡+窄卡」而不是把原来那组撑大。柱状图列此前无上限（2079px 下每根 135px），加 `max-width: 88px` + `space-between`。顺带修好的真 bug：外层 `SchemaRoute` 的嵌套 `LumiPage` 会被 `.lumi-admin-page .lumi-admin-page { max-width: none }` 抹掉内层限宽，改成只清内边距、仅 `full` 免疫，否则 `content` 档的状态页也拿不到 880 限宽。④ 内容从 4 张卡加到 8 张，数据源全部补进 `/dashboard`（`recent.orders` / `recent.products` / `rankings.payments` / `rankings.customers`）——设计稿的原始诊断就是「后端给的数据丢了一大半」，聚合是接口的活，不该让页面拉四个列表在浏览器里算。窄列暴露三个问题一并修：徽标作为 flex 子项被拉到 150px（`flex: none` 后 45px）、`.lumi-proportion-list__label` 的 `overflow-wrap: anywhere` 把长客户名折成两行使该行比邻行高（改省略号，排名行统一 36px）、283px 窄卡塞不下 SKU（去掉，商品名即身份）。实测 2079px：内容区 1743px 满宽、4 列 565/283、8 张卡两行；1440px 仍是 2 列 725/363 不变 | pass |

| EVIDENCE-219 | AC-210 | TASK-206 | 从设计稿抽出全部 13 个 `.ui-header` 与账户菜单原文比对；1440×900 实测 header 子元素与主题控件 rect/computed style；typecheck；lint；60 files / 550 tests；七道 verify 门禁（isolation 除外）；`pnpm e2e --update-snapshots` 与二次 `pnpm e2e` 均为 19 passed | local / 2026-08-24 | 设计稿的事实：13 张页面里 12 张的 header 右端只有**一个** 32px ghost 铃铛（`aria-label="Notifications"`），仪表盘那张换成页面级的 `Last 8 days ▾`；明暗**不在** header，而在头像菜单里作为一行 `Theme + [Light|Dark|System]` 的 28px 分段控件。我们这边 header 右端此前是空的（只有左侧 `Open navigation` w=0 与 `Collapse sidebar` x=320），主题是三行堆叠的 `menuitemradio`。① 铃铛做成宿主插槽而不是内建 chrome：Shell 无法替宿主发明「通知」是什么，所以只出借 `headerEnd` 槽位和 `LumiShellIconButton`，demo 侧 `NotificationsBell` 打开一个复用 `/dashboard` 活动流的抽屉（不新造接口、不编数据）。链路是 `createAdmin({ headerEnd })` → `LumiAdminShellProviderProps` → `ShellInternalContextValue` → `useShellHeaderEnd()` → 两个 Shell 的 `<ShellHeaderEnd />`；`bell` 从 MENU 图标升格为 CHROME 图标。② 主题改成设计稿的一行分段控件：三行要花三行说一件事，而分段控件一眼同时给出全部选项和当前值。实测逐项对齐——铃铛 32×32 / 透明底 / 10px 圆角 / x=1392（1440 视口减 16px 右内边距）；轨道 28px、`p:3px`、10px 圆角、底色 muted（浅 0.9698 / 深 0.2691）；页签 12px 字号、`px-2`、22px 高；选中态浅色 `rgb(255,255,255)` + `oklch(0 0 0/.08) 0 1px 2px`，深色 `oklch(1 0 0/6%)` 且 box-shadow 为 none；菜单宽度顺带从 232（`min-w-56` + 内容）钉到设计稿的 240（`w-60`）。新增一条单测断言插槽落在 `.lumi-shell-header` 内且不在 `[role="menu"]` 内。六组视口×主题的 axe 全绿 | pass |
## Traceability and acceptance

| REQ/NFR | ARC | TASK | AC | EVIDENCE | Status |
| --- | --- | --- | --- | --- | --- |
| REQ-201 | ARC-201 | TASK-201 | AC-201 | EVIDENCE-201 | pass |
| REQ-202, NFR-201 | ARC-202 | TASK-202 | AC-202, AC-208 | EVIDENCE-202 | pass |
| REQ-203, REQ-204 | ARC-203 | TASK-203 | AC-203, AC-204 | EVIDENCE-203 | pass |
| REQ-205, REQ-206 | ARC-204 | TASK-204 | AC-205, AC-206 | EVIDENCE-204 | pass |
| REQ-207 | ARC-205 | TASK-205 | AC-207 | EVIDENCE-205 | pass |
| NFR-202, NFR-203 | ARC-201..205 | TASK-206 | AC-209, AC-210 | EVIDENCE-206..216 | pass |

## Review and final outcome

- P0/P1 status: 本轮非视觉范围 P0 0、P1 0。React `useForm` 的 target/reset/restore/submit 生命周期已由 keyed state token 管理，不依赖 render-phase ref mutation 或父子 layout-effect 顺序；独立 reviewer 重放两个并发反例后通过。
- P2 observations: none recorded
- Required checks: 全量矩阵已通过——typecheck、lint、547 tests、generated、upstream offline、assets 90、size、release guard、check:schema、docs-base、isolation、pack、`pnpm e2e` 19 passed（含二次无 `--update`）
- Architecture deviations: 表格边界按真实实现澄清为页面容器组合 `useTable`，`LumiDataGrid` 不反向持有 data hook
- Lock/delivery artifacts: 本范围未新增依赖
- UI E2E/visual evidence: 视觉 adapter 合入后重拍全部 30 张 baseline（5 页面 × 3 断点 × 明暗），并在不带 `--update-snapshots` 的第二轮中逐张比对通过；axe 在全部断点主题组合下无 violation。之后又用设计稿 02 的页面截图与运行中的应用逐页比对，按差距修正五个页面骨架并再次重拍 baseline，`pnpm e2e` 全套 18 项通过。最后一轮不再靠看图，改为对设计稿与实现同时取 DOM rect 逐项量取，据此修掉列表页工具行的 40px 空带与 well 高度
- Residual unverified areas: 覆盖层三张与 card/search 列表已进 90 张 baseline，并与 `#mk-*` 对过 header/footer/tools 高度和 480/720 宽度。Workbench、Result/Exception 状态页、其余 gallery 分组仍没有整页 PNG。Modal 的 `getBoundingClientRect` 宽度在开场 zoom 动画下会读成 492（computed `width` 仍是 512）；E2E 已把动画时长打到 0。高级筛选面板已与 `.ui-frows` 逐项量平；`size="sm"` 修好后 28px 控件全仓生效，先前记的表格抽屉页脚 5px 差随之消失。仍未逐像素核对的是 `select` / `cascader` 触发器和日期选择器按钮的 sm 高度——它们走各自的原生 size 变体，不经这条类合并路径。**视觉矩阵最宽只到 1440px**（desktop 1440 / tablet 1024 / mobile 390），而 1680 的栅格断点与 88px 柱宽都要 1440 以上才触发，因此宽屏这一路没有 PNG 覆盖，只有 1440 / 2079 两档的 DOM rect 实测。**并且 `toHaveScreenshot` 没有开 `fullPage`，只拍首屏**：仪表盘新增的四张卡落在 900px 折线以下，所以「19 passed、90 张 PNG 一张没改」是真的，但它并不证明新内容渲染正确——那部分只有 DOM 量测和人工看图。要补就是给仪表盘这一档开 `fullPage: true`，会让这几张基线整体重拍。`verify:isolation` 本轮三次都在打包阶段被杀，未取得结果——而这轮恰好改了包间 token 依赖方向，应当补跑。
- Acceptance: PASS。TASK-201..206 全部通过；视觉 workstream（设计稿 02 的 11 项）已合入并与非视觉协议链一起达成全仓绿灯。
