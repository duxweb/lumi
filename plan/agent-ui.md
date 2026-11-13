# Agent 会话界面重构方案

> 状态：已落地大部分（2026-11-11 核对）。会话服务（`core/agent` 的 session、merge、stream、http、bridge）、`AgentSession` 元素、`useAgentChat`、`agentSend`/`agentStop`/`agentRetry`/`agentEvent` 动作，以及 `AgentWorkspace`、`AgentQuestion`、`AgentSessionList`、`AgentMentionPicker` 已实现。**未执行**：§6 里把组件统一改名为 `Agent*` 前缀、handler 命名为 `agent.send` 等——组件仍叫 `ChatThread`、`ChatMessage`、`PromptInput`、`Thinking`、`ToolCall`、`Approval`、`ChangeDiff`、`ContextChips`、`MessageActions`，是否改名待定。面向用户的契约以文档站的「Agent 消息契约」为准；本文其余部分是当时的设计记录。

## 1. 现状问题

依据 `/ui/ai` 截图与 `packages/ui/src/components/agent/*`、`catalog/agent.ts`：

**视觉**

1. 处处是框：工具调用、确认卡、确认卡里的每一行、来源、输入框都是独立描边面，嵌在示例卡片里成了“框中框中框”。读起来像表单，不像对话。
2. 过程和结论同权重：思考、工具调用的高度和边框与回答正文一样醒目，用户找不到“答案在哪”。
3. 没有阅读栏：助手内容横跨 1500px，正文行过长；用户气泡贴在最右，两者之间是大片空白。
4. 头像只是一个 14px 图标，和第一行不对齐；消息没有时间、模型等元信息的位置。
5. 操作按钮、追问建议常驻在每条消息下，堆在正文和输入框之间。
6. 确认卡：每一项一行加分割线，底部是带底色的按钮带，状态徽标是高饱和的黄色，整张卡比答案还重。
7. 输入框只是一个大文本框加一个小发送键，没有工具栏和命令入口。

**结构**

1. 消息 part 是封闭的 9 种类型，没有扩展点：后续要做的卡片、表单、选择题、记录预览都只能改 UI 包源码。
2. 没有“生成式界面”：Agent 无法返回一段由应用 Catalog 渲染的原生 Spec，而这正是 Lumi 相对其他 Chat UI 的独特能力。
3. 会话状态没有归属：消息数组全靠页面 StateStore 绑定；流式接收、停止、重试、确认结果回传都需要每个页面自己写。这与“DataProvider 管后端约定、绑定管远程缓存”的分层不一致。
4. 组件都是成品：ChatThread 硬编码了每种 part 的绘制方式，宿主无法只换其中一块。
5. 测试缺口：PromptInput、ChatMessage 等 10 个组件没有 gallery 示例，`gallery.test` 和 `focus.test` 一直失败。

## 2. 目标

覆盖一个 Agent 会话的全部元素，并为后续的交互和卡片预留统一扩展点：

| 类别 | 元素 |
| --- | --- |
| 会话结构 | 线程、轮次、用户消息、助手消息、系统提示、日期分隔、空状态与开场建议、跳到最新 |
| 流式内容 | Markdown 正文与光标、推理过程、阶段标签、停止、中断、错误与重试 |
| 过程 | 计划、工具调用（输入/输出/错误/耗时）、多步活动汇总 |
| 人在回路 | 操作确认（含勾选项、风险等级）、提问（单选/多选/文本/小表单）、改动预览（字段 diff、文本 diff） |
| 结果卡片 | 记录卡、结果列表、指标、图表、文件、代码，以及任意由 Catalog 渲染的 Spec |
| 依据 | 行内引用、来源列表与预览、上下文（当前页面、记录、选区） |
| 输入 | 多行输入、附件（拖放/粘贴）、@ 引用、/ 命令、模型选择、用量 |
| 会话管理 | 会话列表、新建、重命名、删除、编辑并重发用户消息、重新生成 |

非目标：语音、实时协作、多分支树形浏览（只保留“重新生成”一条线），模拟预览渲染器（AGENTS.md 已排除）。

## 3. 设计原则

1. **正文优先，过程退后**：助手正文是唯一的“主角”；思考和工具调用默认收成一行低对比摘要，展开才看细节。
2. **只有需要用户动手的东西才是卡片**：确认、提问、结果卡片、改动预览有边框表面；其余（正文、活动、来源、操作）都在流里，没有边框。
3. **一条阅读栏**：线程内容最大宽度 46rem 居中（面板模式铺满面板宽度、内边距 16px），用户气泡与助手正文共用这条栏的两端。
4. **决定之后收起**：确认、提问在用户作答后收成一行结果（“✓ 已批准 · 已发送 3 条提醒”），可展开回看。
5. **卡片不另起一套**：结果卡片就是用现有 Lumi 组件（Card、DescriptionList、Table、Chart、Badge…）拼出的原生 Spec。不为 AI 再做一套 Card/Table。
6. **一份服务实现**：流式会话由 Lumi 服务层持有，React hook 与 JSON handlers 共用同一实现，与 data/request/upload 一致。

## 4. 视觉规范（并入 ui-design-spec）

| 元素 | 规则 |
| --- | --- |
| 用户消息 | 靠右，`--muted` 底、无边框、圆角 18px（右下 6px），最大宽度为栏宽的 80%；附件与上下文以小芯片排在气泡上方；悬停显示“编辑”“复制” |
| 助手消息 | 无气泡，与栏左缘对齐。只在一轮开头显示 20px 品牌标记和名称（可选时间、模型）；同一轮内的后续部分不重复 |
| 正文 | Prose `md`（面板为 `sm`），流式光标为 2px 竖条闪烁；`prefers-reduced-motion` 时不闪 |
| 活动 | 一行：状态图标 14px + “思考了 3.8 秒 · 调用 2 个工具” + 折叠箭头，`--muted-foreground`。展开为竖向时间线：细连接线、每步一行（图标、名称、耗时、状态），工具步骤可再展开输入/输出代码块（CodeBlock，最大高度 240） |
| 进行中 | 活动行的标签使用当前阶段（“正在查询订单”），文字做 1.6s 微光扫过；无其他动画 |
| 交互卡片 | `--card` 底、1px `--border`、圆角 12px、内边距 14/16。头部：16px 图标 + 标题 + 右侧状态文字（不使用彩色徽标，风险用图标色表达）。底部操作右对齐，无底色带；主操作为 primary，`danger` 时为 destructive |
| 确认项 | 紧凑勾选列表，行高 32px，无行间分割线；超过 5 项折叠为“还有 N 项” |
| 结果卡片 | 与交互卡片同一外壳；头部可有“在侧栏打开”，Workspace 模式下在右侧 Artifact 面板展开 |
| 引用 | 行内上标式小芯片 `1`（16px 高，`--muted` 底），悬停/聚焦预览来源；回答末尾“3 个来源”一行，叠放站点图标，点击展开列表 |
| 操作 | 复制、重新生成、赞/踩为 28px 幽灵图标按钮；最后一条回答常驻，历史消息在悬停或聚焦时出现（触屏常驻） |
| 追问建议 | 只跟随最后一条回答，竖排文字链接，前置 `↳` 图标，`--muted-foreground`，悬停变前景色 |
| 错误 | 正文下方一行 danger 色文字 + “重试”文字按钮，不用整块 Alert |
| 输入框 | 卡片式：上方芯片行（附件、上下文），中间自增高文本区，底部工具栏：左侧 附件 / @ / / 命令 / 模型选择，右侧 32px 圆形发送键（生成中变停止）。聚焦时整卡显示 ring；支持拖放与粘贴文件 |
| 空状态 | 居中问候语 + 一句说明 + 2×2 开场卡片（图标、标题、一行描述） |
| 跳到最新 | 离底部超过一屏时，底部中央出现圆形向下按钮，新内容到达时带数字 |

明暗主题、品牌色全部来自现有 token，不新增调色板。

## 5. 消息协议

保留现有 `AgentMessage { id, role, parts, status, metadata }`，与 AI SDK `UIMessage` 同名同义的字段继续对齐。改动：

1. **新增 `question` part**：Agent 向用户提问。
   ```json
   { "type": "question", "id": "q1", "title": "要提醒哪个仓库？", "mode": "single",
     "options": [{ "value": "cd", "label": "成都仓", "description": "3 单超时" }],
     "allowText": true, "status": "pending", "answer": null }
   ```
   `mode`: `single` | `multiple` | `text` | `form`（`form` 带 `fields`，复用 Form 字段定义）。作答写回 `answer`，并发出 `answer` 事件。
2. **新增 `ui` part（生成式界面）**：
   ```json
   { "type": "ui", "id": "u1", "title": "超时订单", "spec": { "root": "...", "elements": { } } }
   ```
   用应用的同一份 Catalog 校验并渲染（与 `lumi-check` 同一校验）。每个 part 有独立 StateStore；其中的 `on` 只能调用已注册的 action，`pushState` 只能写自己的 state。校验失败时显示一行“无法显示此内容”，开发模式附诊断。
3. **新增 `data-*` 扩展 part**：`{ "type": "data-order-card", "id": "...", "data": { } }`，与 AI SDK 同名约定。宿主通过注册表提供渲染组件；未注册的类型不渲染，开发模式提示。
4. **确认卡的内容形态**：`approval` part 增加 `fields`（`[{ label, value, description?, editAction? }]`，描述列表式确认，用于退款、改价、审批）、`lines`（`[{ title, meta?, image?, amount? }]`，商品行）、`total`（`{ label, value }`）和 `confirmLabel`。三者可与 `items` 勾选列表组合。渲染时不另造组件：`fields` 用 UI 的 DescriptionList（`layout: "rows"`，新增 `bordered` 外观：整体圆角外框、行间细线，其他页面也能用）；`lines` 用 UI 包内的条目行（缩略图、标题、说明、金额；Admin 的 RecordList 不能被 UI 依赖，所以把条目行下沉为 UI 的公开组件，RecordList 改为复用它）；`total` 只是卡片底部的一行。下单类确认点击后锁定按钮显示进度，等注册动作返回再收起；失败时在卡片内显示原因和重试，不收起。
5. **前台可用**：Agent 组件只依赖 UI 包，不依赖 Admin，商城、会员中心等前台页面可以直接用 AgentThread + AgentComposer；Admin 只额外提供面板和工作区外壳。
6. **确认对齐 AI SDK**：`approval` part 增加可选 `approvalId`，与流协议的 `tool-approval-request` 对应；其余字段不变。
7. **`metadata`**：`{ model?, createdAt?, usage? }` 显示在轮次头部和用量里。
8. **派生分组，不改协议**：渲染时把一轮中连续的 `reasoning`、`tool-call`、`plan` 合并成一个“活动”块；后端照常逐个发送。

流式传输采用 AI SDK UI Message Stream 的 SSE 分块（`start`、`text-start/delta/end`、`reasoning-*`、`tool-input-*`、`tool-output-available`、`tool-approval-request`、`data-*`、`start-step/finish-step`、`finish`、`abort`、`error`，响应头 `x-vercel-ai-ui-message-stream: v1`）。实现前用 Context7 核对版本差异。Go 后端按此格式输出即可。仓库附一份 Go 侧格式说明，但不附 Go SDK。

## 6. 架构与包职责

```
@duxweb/lumi            会话服务：传输、流解析、消息归并、停止/重试/确认/作答
  /catalog              消息与流分块的 zod 定义（框架无关，供 check 和服务端校验）
  root                  AgentSessionProvider、useAgentSession、agent.* handlers
@duxweb/lumi-ui         纯展示组件与注册表；不发请求
  /catalog              组件定义
@duxweb/lumi-admin      AgentPanel（Shell 助手位）、AgentWorkspace 页面、连接组件
```

### 6.1 Lumi 服务（新增）

- `AgentTransport` 接口：`send({ sessionId, messages, body })`、`stop`、`resume?`，默认实现为 `fetch` + SSE 解析。
- `createAgentSession`：持有消息数组与状态（`idle | submitting | streaming | error`），把流分块归并进消息；暴露 `send(text, { attachments, context })`、`stop()`、`regenerate(messageId)`、`edit(messageId, text)`、`approve(approvalId, selected)`、`reject(approvalId)`、`answer(questionId, value)`。
- 防重复：生成中再次发送会被拒绝；确认和作答在请求返回前锁定按钮，失败时恢复（与表单提交规则一致）。
- 会话列表通过现有 DataProvider 读写（`resource: "agent-sessions"`），不新增资源注册机制。
- JSON handlers：`agent.send`、`agent.stop`、`agent.regenerate`、`agent.approve`、`agent.reject`、`agent.answer`、`agent.newSession`，与 hook 共用同一实现。

### 6.2 UI 组件（替换现有 10 个）

分两层：**部件**可单独使用；**组合件**按协议整条渲染。名称统一 `Agent` 前缀；旧名直接改写，不保留别名。

| 新组件 | 取代 | 说明 |
| --- | --- | --- |
| `AgentThread` | ChatThread | 滚动容器、贴底跟随、跳到最新、空状态、日期分隔；按协议渲染每条消息 |
| `AgentMessage` | ChatMessage、MessageActions | 用户/助手两种布局，轮次头部、操作与追问 |
| `AgentActivity` | Thinking | 推理 + 工具 + 计划的汇总行与时间线 |
| `AgentToolCall` | ToolCall | 时间线中的一步，也可单独使用 |
| `AgentPlan` | AgentPlan | 视觉改为时间线样式 |
| `AgentApproval` | Approval | 新外壳，决定后收起 |
| `AgentQuestion` | 新增 | 单选/多选/文本/小表单，作答后收起 |
| `AgentDiff` | ChangeDiff | 字段 diff 与文本 diff |
| `AgentArtifact` | 新增 | 结果卡片外壳：标题、图标、操作、展开；内容为 slot 或 `ui` Spec |
| `AgentSources` | 来源芯片 | 行内引用 + 来源列表 |
| `AgentComposer` | PromptInput、ContextChips | 输入框、芯片行、工具栏、/ 命令菜单、@ 菜单、模型选择、用量 |
| `AgentMentionPicker` | 新增 | @ 引用：自带搜索框、按类型切换（订单/文章/商品/客户…）、结果分组、关键词高亮、键盘选择、加载与无结果状态；数据源由宿主按 `resource` 声明，经 DataProvider 远程搜索，复用 UI 现有的搜索输入与远程分页选择逻辑 |
| `AgentSessionList` | 新增 | 会话列表：左侧固定状态点位（生成中/等待确认/有新回复），`variant: compact | detailed`，detailed 显示时间和最后一句摘要；顶部用 UI 搜索输入 |

React 层另导出 `agentPartRenderers`：宿主可以按 part 类型覆盖或新增渲染组件，用于 `data-*` part 和替换内置部件。JSON 侧通过 Catalog 中注册的组件名引用，不传 React 组件。

### 6.3 Admin

- `AgentPanel`：Shell `assistant` 位的成品面板，包含头部（会话标题、新建、历史下拉、关闭）、线程、输入框。自动把当前路由和选中记录作为上下文芯片。
- `AgentWorkspace`：全页三栏：会话列表 | 线程 | Artifact 面板（点开结果卡片时出现，可关闭；窄屏时变为抽屉）。
- 连接组件 `AgentSession`（JSON 用）：`{ "type": "AgentSession", "props": { "endpoint": "/agent/chat", "sessionId": { "$state": "/session" } } }`，子树中的 AgentThread/AgentComposer 自动连到同一会话。

## 7. 交互与状态归属

| 状态 | 归属 |
| --- | --- |
| 会话消息、流状态 | Lumi 会话服务（相当于远程缓存），JSON 只读绑定 |
| 输入框草稿、选中模型、待发附件 | StateStore（页面可编辑状态） |
| `ui` part 内部状态 | 每个 part 独立 StateStore，随消息保存可选 |
| 面板开关、宽度、当前会话 | Admin Shell 状态 |

事件统一为 `agentEvent { type, messageId?, partId?, value? }`。类型集合为：`copy`、`regenerate`、`feedback`、`suggestion`、`openSource`、`approve`、`reject`、`answer`、`edit`、`action`、`openArtifact`。

键盘：
- 输入框：Enter 发送，Shift+Enter 换行，Esc 停止生成；`/` 和 `@` 弹出菜单，菜单内方向键选择。
- 线程：交互卡片按 Tab 顺序可达；确认卡内 Enter 执行主操作。

## 7.1 前端桥接（Agent 操作界面）

目标：Agent 能读到当前页面，在前端做**轻操作**：填充（筛选、表单字段、选中行）和提示（跳转、高亮行、闪烁控件、引用到对话），组件不需要任何显式声明。**写业务一律由后端工具负责**；前端不保存、不删除、不提交。

**范围。**

| Agent 可以 | Agent 不可以 |
| --- | --- |
| 读当前页面、路由、工作区、页面状态 | 切换工作区或租户、登录登出、改权限 |
| 跳转路由（不越过未保存提醒） | 触发会改数据的事件：create、update、delete、request、submitForm，或带 `confirm` 的 |
| 写绑定的状态：筛选、选中行、表单字段、弹窗开关（不覆盖用户的修改） | 提交表单：Agent 只填写，用户检查后自己提交 |
| 高亮表格行、闪烁按钮或链接、引用行到对话 | 写未绑定的状态，执行任意代码 |
| 触发轻事件：切换标签、开关抽屉、刷新、校验 | 操作没有注册的 React 代码页面 |

**自动注册。** json-render 的注册表组件拿不到自身的元素 key，所以注册放在页面级：`LumiSpecPage` 挂载时用 Spec 和 StateStore 向 `lumi.agentBridge` 注册当前页（`agent={false}` 可关闭，示例与预览应关闭）。桥从 Spec 中读出：
- 带 `$bindState` 的 props 和 `statePath`，作为可写路径（`bind`）；
- 事件分两类：`events` 是轻事件（动作都在安全列表里且没有 `confirm`），`writes` 是会改数据的事件。安全列表：setState、pushState、removeState、validateForm、navigate、openDrawer、closeDrawer、invalidate、toast、notify、closeNotice，可用 `agent.safeActions` 覆盖；
- 带 `href` 的链接按钮；
- 标签（title / label / ariaLabel / placeholder / name，`$t` 已翻译）和 `info`（resource、列字段、表单字段、href）。

Admin Shell 注册导航：当前路由、菜单里的全部路由（已翻译标题和分组）、当前工作区（只读），以及通过 Shell 跳转。

**快照随每条消息发送。** `useAgentChat` 的请求体追加三项：
- `ui`：`route`、`routes`、`workspace`、`page`（`elements` 和压缩后的 `state`：列表保留前 10 项、长文本截断、深度 6）；
- `clientTools`：工具定义（名称、描述、JSON Schema）；
- `approvalMode`。

后端把 `clientTools` 作为工具交给模型，把 `ui` 放进上下文。

**前端工具（客户端工具，都不需要审批）。**

| 工具 | 输入 | 作用 |
| --- | --- | --- |
| `ui_navigate` | `{ path }` | 通过 Shell 跳转；等新路由的页面注册后再返回。被未保存提醒拦住时返回失败 |
| `ui_set_state` | `{ path, value }` | 只允许写 `bind` 路径或其下层，建议写最窄的路径（`/draft/title`） |
| `ui_highlight` | `{ keys }` 或 `{ element }` | 标出表格行，或让控件闪烁（三次脉冲描边），并滚动过去 |
| `ui_trigger` | `{ element, event }` | 只触发 `events` 里的轻事件；`writes` 里的直接拒绝，并提示改用后端工具或请用户自己点 |

执行流程（对齐 AI SDK 客户端工具）：
1. 服务端流出 `tool-input-available` 后以 `tool-calls` 结束。
2. 会话保留该调用为 running，由前端执行。
3. 全部调用有结果后，以 trigger `tool-output` 续写同一条消息。

**与用户直接录入的冲突处理。**
- **页面已切换：** 每次请求记下快照对应的页面；工具执行时前台页面变了就拒绝，Agent 读新快照再操作。
- **快照过期：** 每次请求也记下当时的状态。写入时逐字段比较，用户在 Agent 思考期间改过的字段保留不动，并在结果里用 `kept` 告诉 Agent；对象按字段合并，其余字段照常写入。Agent 自己先前的写入不会被当成用户修改。
- **用户正在输入：** 当前获得焦点的表单字段（按 `name` 对应到绑定路径）不写，同样列入 `kept`。Agent 的输入框和会话区不算。
- **未保存提醒：** 跳转被拦住时报告失败，等用户确认。

**审批两种模式只用于后端工具。** `ask`（每次询问）下，后端写业务的工具先出审批卡；`auto`（完全权限）直接执行。模式保存在桥里，存 localStorage `lumi:agent:approval-mode`，随请求发给后端；输入框的权限下拉（PromptInput `approvalMode`）切换它，`useAgentApprovalMode()` 读写它。会话对客户端工具保留同样的审批机制（工具定义 `approval`），供宿主自己的客户端工具使用，比如本地打印；桥的前端工具不使用它。

**引用、高亮与工作区。**
- **引用到对话：** UI 提供 `LumiSelectionExtras`，宿主通过它给下面所有表格的选择栏追加命令（`useSelectionExtras` 读取；没有批量操作时，只要有追加命令也会显示选择栏）。Admin Shell 在有助手面板时追加“引用到对话”：选中行经 `bridge.reference()` 变成 `record` 上下文芯片，`data` 带上整行字段（只发给 Agent，不显示），并自动打开助手。`useAgentConversation` 用 `bridge.onReference` 接收，没有会话在听时先暂存。UI 不依赖 Lumi 和 Admin。
- **行高亮：** Lumi 页面派发 window 事件 `lumi:highlight`（UI 导出常量 `LUMI_HIGHLIGHT_EVENT`），页面上所有表格标出对应行（key 按文本比较）、滚动到第一行，4 秒后淡出。
- **控件闪烁：** 按快照里元素的标签，在页面上找可见的按钮、链接或标签页（排除带 `data-agent-surface` 的助手面板和会话区），加 `data-agent-flash` 2.4 秒；开启“减少动态效果”时只显示描边。
- **工作区（租户）：** 快照只读地带上 `workspace`，Agent 不能切换。切租户是安全边界，由人来操作；后端按它限定工具范围。数据层的多租户由 `tenantProvider` 承担：请求带 `X-Tenant`，切换时同帧重置全部 Lumi 查询，Admin 按应用持久化当前工作区。

## 8. 分期

| 期 | 内容 | 验收 |
| --- | --- | --- |
| P1 视觉重做 | 按 §4 重写样式与布局；活动分组（派生）；交互卡片新外壳；输入框工具栏；演示页去掉调试信息块 | 截图评审；现有行为测试通过；补齐 10 个组件的 gallery 示例，`gallery.test`、`focus.test` 转绿 |
| P2 协议扩展 | `question`、`ui`、`data-*` part；`agentPartRenderers`；改名为 Agent*，同步 Catalog、文档、check | 原生 Spec 用例；`ui` part 校验失败与 action 白名单测试 |
| P3 会话服务 | Lumi 传输、SSE 解析、归并、handlers、hook；mock 服务端流式接口 | 流分块归并单测（含中断、错误、确认往返）；停止与防重复测试 |
| P4 Admin | AgentPanel、AgentWorkspace、AgentSession 连接组件；会话列表走 DataProvider | e2e：发送 → 流式 → 工具 → 确认 → 结果卡片 → 侧栏打开 |
| P5 收尾 | 文档页、llms、size 预算（会话服务按需加载）、changeset | 全部根门禁 |

P1 不改协议，可以先单独交付，尽快解决“丑”的问题。P2 起是破坏性改名，按 AGENTS.md 的要求一次改写所有生产者和消费者。

## 9. 已做的决定

- 组件统一改为 `Agent*` 前缀，不保留旧名别名。
- 流协议对齐 AI SDK UI Message Stream，但不依赖 `ai` 或 `@ai-sdk/react` 包：解析器约 300 行，自己维护，避免把它们的 React 运行时带进来。
- 结果卡片只走 `ui` Spec 和 `data-*` 注册表两条路，不新增 AI 专用的卡片/表格组件。
- 不做分支树；“编辑并重发”会截断其后的消息。
