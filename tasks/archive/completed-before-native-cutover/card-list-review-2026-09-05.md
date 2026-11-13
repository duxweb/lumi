# 卡片列表交付与整体审查

日期：2026-09-05。范围：React Admin 卡片列表实现；全仓架构、主题与主要功能检查。Vue 仅检查现有 headless 逻辑，不新增 UI/Admin。

## 交付

- 新增 Admin 组合组件 `LumiCardList` 和 `LumiRecordCard`，由注入的 `RendererContract.Card` 提供卡片容器，不直接依赖具体适配器，不引入新依赖。
- 项目卡片和文章搜索共用该实现；筛选、查询和分页仍留在路由容器，未建立第二套数据逻辑。
- 卡片页最大宽度 1440px，按可用空间自动分列；标题/状态、完整描述、属性、实际进度、日期独立分区。文章结果使用单列阅读布局。
- 使用既有语义颜色、字号和圆角；不增加执行色板或示例私有样式。
- 支持加载、空结果、错误和明确恢复动作，补充单元测试、响应式与筛选/分页/重试浏览器测试，并同步 API 文档和视觉资产清单。

## 首轮审查发现（原始证据；处理结果见文末）

### P1：headless 认证 mutation 不同步认证查询缓存

位置：`packages/react/src/providers.ts:8`、`:19`、`:42`；`packages/vue/src/composables/useProviders.ts:10`、`:21`、`:44`。

`useLogin` / `useLogout` 只执行 provider 调用，没有刷新或清除 `check`、`identity`、`permissions`、`access` 查询。身份查询 key 不含会话标识。在保留同一个 Provider / QueryClient 的宿主中，登出后仍会返回上一个用户的身份，切换账号也可能继续使用旧的授权展示缓存。

已用 React 独立挂载探针复现：预置 user-a 身份，保持 `useIdentity` 挂载，执行 `useLogout().mutateAsync()`；provider 身份变为 null，但 hook 和缓存均仍为 user-a。探针使用 `staleTime: Infinity` 排除无关后台刷新，属于公开配置允许的使用方式。Vue 对应实现存在相同缺口，未另行运行同一探针。

建议：统一认证生命周期，成功切换会话后取消旧请求、清理会话相关数据，并刷新必要的身份/权限查询；React/Vue 同步补测试。不要仅修复 Admin 登录按钮。当前 Admin 自身有 `onLogout={clear}`、重建路由和登录后 `refresh` 流程，本报告不把 headless 复现扩大为已证明的 Admin 跨账号数据泄漏；也未证明服务端授权绕过。

### P1（发布门禁）：构建产物超过既定体积预算

位置：`config/lumi-size-budgets.json:19`、`:31`；`scripts/verify-size-budgets.mjs:35`。

全仓生产构建成功，但 `pnpm verify:size` 失败。按门禁相同的 gzip level 9 重新测量：

| 产物 | 实际 | 上限 | 超出 |
| --- | ---: | ---: | ---: |
| UI JS gzip | 28,600 B | 27,648 B | 952 B |
| Admin 入口 JS raw | 1,340,667 B | 1,310,720 B | 29,947 B |

UI CSS 及 Admin gzip 仍在预算内。第一个失败会让脚本提前退出，因此额外读取全部预算项确认第二项。工作区包含既有大规模迁移，未将全部增长归因于本轮卡片。未提高阈值或修改门禁；应先分析入口依赖与产物组成，再优化或单独确认预算变更。当前状态不能视为可直接发布。

### P2：headless 层仍保留具体过滤器 UI

位置：`packages/react/src/components/LumiFilter.tsx:10`、`packages/vue/src/components/LumiFilter.tsx:11`；两包 `package.json` 的 CSS 导出和 `build:css`。

两套 LumiFilter 内含具体 Tailwind 样式、原生交互控件和视觉排列，并各自构建发布 CSS。这与“绑定层仅保留 headless；具体 UI 只有 ui-shadcn”的目标边界不一致，也增加 React/Vue 行为及翻译漂移的维护面。

建议：保留共享过滤模型转换及绑定层状态逻辑，视觉通过中立 Filters contract 交给唯一适配器；删除重复视觉实现需独立迁移消费者、导出和相关测试。本轮没有新增 Vue UI，也没有擅自删除这些既有实现。

### P2：Admin 仍消费适配器私有主题变量

位置：`packages/admin-react/src/components/ShellParts.tsx:283`、`:478`、`:583`；`packages/admin-react/src/style.css:972`、`:976`、`:1150`、`:1241`。

Shell 浮层阴影和部分状态色读取 `--lumi-ui-overlay-shadow` / `--lumi-ui-tone-*`。当前适配器下能正常显示，但形成了 TypeScript 导入检查看不到的 CSS 层依赖；私有实现调整或宿主提供其他 contract 时会退回不同效果，移动导航阴影没有 fallback。

建议：把跨层需要的阴影/状态语义明确为公共主题变量，再统一消费。不是增加第二套色板。本轮新卡片仅使用 `--border`、`--muted`、`--primary` 等已有语义变量。

## 已核实，不作为缺陷报告

- core/schema/runtime 源码未发现 React/Vue 或具体 UI 运行时导入；Admin 未发现直接导入 ui-shadcn/Radix/shadcn 内部组件。
- 旧过滤器的 `--lumi-primary` / `--lumi-border` / `--lumi-foreground` 并非未定义：`config/lumi.tailwind.css` 将其映射到公共语义变量。不能据此认定当前样式失效。
- 新卡片组件是 Admin 页面组合，不是新增 Schema 标准节点，未向 schema 注入适配器私有 API。
- UI 上游源码清单与生成协议/文档检查通过；发布失败会阻止 Changesets publish 的 guard 通过。

## 验证与边界

- `pnpm typecheck`：全仓通过，包括 Vue headless。
- `pnpm lint`：通过。
- `pnpm test`：61 个文件、561 个测试通过，覆盖 core、schema、runtime、React/Vue 绑定、adapter、Admin、checker、MCP 等现有测试集。
- `pnpm build`：全仓通过，包括文档构建、文档链接检查。
- `pnpm verify:generated`、`verify:release-guard`、`verify:upstream:offline`、`verify:assets`：通过；资产仍为 84 张自有截图，未降低截图阈值。
- `pnpm exec playwright test -c playwright.react-admin.config.ts`：20 个测试通过。覆盖卡片与表单 320/768/1440/2560px；主要 CRUD、筛选/分页、dirty/save、设置、抽屉/弹窗、Shell 导航与登出；桌面/平板/手机 × 明暗主题的 84 个页面视觉断言及 axe 检查。
- 未执行外部真实后端、完整跨浏览器/生产环境验收或全部发布隔离流程。浏览器功能验证使用仓库 mock。
- Shell 单元测试有现存异步 `act(...)` 警告，测试虽通过，后续应清理以提高异步断言可信度。
- 体积门禁失败，且认证缓存与分层问题仍待处理；“测试通过”不代表上述发现不存在。

建议后续顺序：认证生命周期 → 产物体积 → headless 视觉迁出 → 公共主题变量收口；每步独立验证，Vue 只同步逻辑。

## 修复结果（2026-09-05）

以上四项已落地：

1. React/Vue 登录和登出共享串行 mutation scope。成功时取消旧 Lumi 请求、删除无订阅缓存、重置有订阅查询并刷新启用查询；失败保留会话，宿主其他命名空间不受影响。26 项认证回归覆盖 mounted/disabled、晚到请求、失败响应/异常与并发排序。
2. `LumiFilter` 变为中立 `Filters` bridge，renderer 显式注入 contract；React/Vue 两个旧 `src/style.css`、CSS 导出和构建步骤已删除，宿主只导入 UI/Admin 样式。原生 Form 不再强加视觉布局。无新 Vue UI/Admin。退役样式可从 Git 历史恢复，未删除业务数据。
3. Admin 状态色使用公共 `--success` / `--warning` / `--destructive`，浮层使用公共 `--shadow-overlay`。新边界测试禁止 Admin 重新读取 `--lumi-ui-*`；不增加第二套色板或品牌主题配置。
4. UI ESM 发布启用 minify 并保留 source maps/types。Schema 由同一真源另行生成精简校验元数据，浏览器不再因校验而带入作者说明/类型展示文本；完整目录保留，新增逐字段一致性测试。没有删校验、升预算或用静态分包绕过门禁。

独立复查另外发现 direct `LumiFilter` 的语言切换回归，现已修复：binding 随 locale 深度解析 `$t`，通过既有 `TextTranslator` 向 adapter 提供 host-only 文案回调。回调不进入 JSON Catalog；中文/英文切换、嵌套预设、显式 renderer 与 adapter 文案测试均通过，二次只读复查未发现新的阻断问题。

### 体积结果

所有数值使用原门禁 gzip level 9；阈值没有修改。

| 产物 | 修复前 | 修复后 | 上限 |
| --- | ---: | ---: | ---: |
| UI JS gzip | 28,600 B | 22,039 B | 27,648 B |
| Admin 入口 JS raw | 1,340,667 B | 1,308,211 B | 1,310,720 B |
| Admin 入口 JS gzip | 389,108 B | 382,752 B | 393,216 B |
| UI CSS gzip | 14,998 B | 15,000 B | 16,384 B |

Admin 入口距 raw 上限只有 2,509 B，后续新增功能必须继续关注依赖组成；通过门禁不代表没有进一步性能优化空间。Vite 默认的大 chunk 提示仍存在，未隐藏。

### 接入注意事项

- `LumiFilter` 需要显式或注入的 `Filters` contract；不再提供具体原生控件 fallback。`onReset` / `reset` 现在表示应用后的条件为空，包含清除最后一个条件；显式草稿应用只在提交后触发。
- 不要通过 QueryClient 的固定 `initialData` 注入会话身份/私有数据：TanStack reset 会恢复 initialData。当前官方查询 hook 不提供该输入；此宿主配置边界已在 React/Vue README 说明。
- 直接调用 AuthProvider 不经过 hook 管理的缓存生命周期。服务端仍须自行验证授权；前端缓存刷新不是安全授权边界。
- 工作区保留原有未提交迁移，未提交或发布本次修改。

### 最终验证

- 全仓 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过；最终单元测试为 66 文件 / 597 项。
- `pnpm check:schema` 通过，保留 36 项 TS / Rust native / WASM 协议回归。
- 完整 `CI=1 pnpm e2e`：28/28 通过；i18n 补修后 `pnpm e2e:react-admin` 再次 20/20 通过，包括 84 张原有截图及 axe、320/768/1440/2560px 行为测试。未更新视觉基线或阈值。
- `verify:generated`、`verify:assets`、`verify:upstream:offline`、`verify:release-guard`、`verify:size`、11 个发布包内容检查均通过。
- 发布格式检查 `publint` / `attw` 通过。实际远程后端、多浏览器/生产部署不在本次验证范围内；浏览器用仓库 mock。
- `smoke:ui-shadcn-pack` 与 `create-lumi check:template` 最终通过：实际安装 tarball、检查公开组件/CSS，并在隔离脚手架中 typecheck/build。最初 offline 安装缺包是工作区与临时目录使用不同 pnpm store；按检查进程使用的 pnpm 9/store v3 补齐缓存后通过，未修改检查脚本或安装约束。
