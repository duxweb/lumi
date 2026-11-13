# Admin 全页视觉与流式布局复查

本轮针对组件演示卡片之间的大块空隙、Workbench 超宽屏只占半行与项目名截断，继续按既有 ReUI / Vercel 中性视觉规范检查 Admin 全部页面及交互状态。保留现有语义 token、HugeIcons、native Spec、公共组件分层与后端行为。

## 本轮调整

- 组件演示按内容高度流式排布，列内保留 20px token 间距；源码展开、窗口缩放会重新测量。保持 DOM、键盘顺序与 native StateStore，不因换列丢失输入。
- 搜索选择与多选使用统一弹层，搜索框和选项在展开后出现。多选用紧凑标签显示结果；支持键盘、焦点返回、禁用选项、远程搜索和原始值类型。普通选择的清除按钮收进控件，可见示例标签区分默认、搜索、禁用等状态。
- Workbench 聚焦快捷入口、项目和动态，去掉重复业务 KPI。快捷入口占整行，项目与动态按容器形成两列或一列；项目名称、负责人和进度独立排版。
- 修复公共 Dashboard 内容在超宽容器意外变成四列、Settings 两字段只占半行、独立分页控件布局松散、竖向 Stepper 分隔符过粗与 loading 指示重复。
- 修复手机展开筛选后日期范围撑宽容器的问题；筛选、Reset、Columns 在 320px 仍可操作。
- 通知订单分成身份/金额与客户/日期两行，保留完整信息。
- 修复图表主题重绘时上游修改宿主定位造成画布从 240px 变成 500px 的问题，重建实例后立即按容器尺寸绘制，统一处理后续缩放。
- 共享状态 variants，修复 Admin 后加载工具类覆盖深色 Radio/Checkbox 选中态；半选状态显示横杠。UI CSS 仅扫描生产源码，复用基础工具类消除重复声明，保持原有体积上限。
- 抽屉程序聚焦时不再出现整圈浏览器白色轮廓；内部控件的键盘焦点环保留。修复抽屉分页把底部统计挤成两行的问题，账户时间线改用可读日期时间。

## 验收方式

使用真实 Chromium 检查业务页、全部组件演示、列表、表单、详情、设置、结果页、账户页和覆盖层；同时检查明暗主题与手机、平板、桌面、超宽屏。截图来自当前本地实现，不引入外部视觉素材。

## 截图检查范围

- 全部 37 条 manifest 路由在 1440px 下检查明暗两种主题。
- 11 个代表页面额外检查 390 / 1024 / 1920px 明暗主题；Workbench、Choice、项目卡片和商品详情再检查 2560px。
- 共 236 个场景：156 个页面/主题/宽度组合、32 个覆盖层/菜单/筛选场景、48 个控件展开/后续表单/恢复状态。
- 索引包含 337 张页面及滚动段截图，另有两张 Choice 全页截图。实际逐张检查了全部 236 个场景首屏和 30 张桌面滚动段，共 266 张索引截图；其他响应式滚动段保留供查阅，不将“已截图”当成“每张全尺寸复审”。发现问题另行放大检查并在修复后重拍。
- 156 个主场景均确认内容已挂载，未发现页面/主内容横向溢出，捕获时没有运行时 pageerror。使用 Chromium；这份记录不代替其他浏览器或任意数据组合的验收。

本地[截图总览](/tmp/lumi-visual-audit-20260923/final/index.html)、[逐路由验收记录](/tmp/lumi-visual-audit-20260923/final/report.md)与[人工检查索引](/tmp/lumi-visual-audit-20260923/final/reviewed-inventory.json)包含全部场景和截图。上一级目录的旧图仅用于诊断；以 `final` 目录及仓库内更新后的 E2E 基线为准。

常用对照：[组件页](../e2e/react-admin.spec.ts-snapshots/gallery-choice-desktop-light.png)、[工作台](../e2e/react-admin.spec.ts-snapshots/workbench-desktop-light.png)、[深色组件页](../e2e/react-admin.spec.ts-snapshots/gallery-choice-desktop-dark.png)、[手机工作台](../e2e/react-admin.spec.ts-snapshots/workbench-mobile-light.png)。

## 最终验证

- `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm check:schema` 通过。
- `pnpm test`：43 个文件、314 项通过。
- `pnpm e2e --update-snapshots` 覆盖 5 个应用、51 项测试：初跑 48 项通过；修正新增测试将原生 summary 错当 button 的定位，并为包含 21 页与 3 个 Settings 分组的截图巡检设置 60 秒局部预算后，失败的 3 项全部补跑通过。没有略过断言或改产品代码来绕过测试。
- 浏览器回归包含流式间距/源码展开/缩放后输入保留、选择器键盘与焦点、明暗选中态、320px 筛选及通知可读性、图表主题重绘，以及既有保存、校验、筛选、分页、覆盖层、权限和无障碍检查。
- `pnpm verify:upstream:offline` 通过，25 份固定 owned source 未改动；`pnpm verify:size` 通过，原有预算未提升（UI CSS 104,989 raw / 16,517 gzip bytes）。
- 最后的测试脚本修改已单独通过 ESLint；`git diff --check` 通过。

完整命令日志位于 `/tmp/lumi-visual-{lint,typecheck,test,build,schema,e2e,e2e-final,size,upstream}.log`。本轮已同步视觉规范并添加 UI / Admin patch Changeset。
