export type Locale = 'zh' | 'en'

export const LOCALES: Record<Locale, { label: string, home: string, lang: string }> = {
  zh: { label: '中文', home: '/', lang: 'zh-CN' },
  en: { label: 'English', home: '/en/', lang: 'en' },
}

/** Every string on the site, per language. Keys mirror the page's sections. */
export const COPY = {
  zh: {
    title: 'Lumi：为 AI 而生的中后台前端框架',
    description: 'Lumi 让 AI 用 JSON 写后台：不用编译，省时间也省 token；有目录约束，界面不跑偏；改完即校验，Agent 内置在后台里。',
    nav: { docs: '指南', components: '组件', playground: 'Playground', demo: '完整演示', site: '站点', language: '切换语言' },
    hero: {
      tag: 'Lumi 0.1.0 即将发布，基于原生 json-render',
      title: ['为 AI 而生的', '后台前端框架'],
      lede: 'AI 写的是 JSON，不是代码。不用编译，改完就能看；有组件目录兜底，界面不会跑偏；每次改动先过校验。后台里还内置了 Agent，和用户一起干活。',
      start: '开始使用',
      playground: '打开 Playground',
      copy: '复制安装命令',
      copied: '已复制',
    },
    showcase: { label: '实时演示', note: '这是一个真实运行的 Lumi Admin，每个页面都是一份 JSON。点点菜单，改改数据试试。' },
    pillars: {
      eyebrow: '为 AI 而生',
      title: '为什么说为 AI 而生',
      items: [
        { title: '不用编译', text: 'AI 只改一段 JSON，刷新就生效。不跑构建，也省 token。' },
        { title: '界面不跑偏', text: '只能用目录里登记过的组件和动作，改十遍还是同一套界面。' },
        { title: '改完就校验', text: '每条错误指到具体字段，AI 照着就能改对。' },
        { title: '内置 Agent', text: '在后台里对话、引用数据。改数据前先给你审批。' },
      ],
    },
    flow: {
      eyebrow: 'AI 在哪里',
      title: '从写页面到用后台，AI 全程在场',
      lede: '开发时 AI 按目录写页面、自己校验；上线后同一个后台里，Agent 陪用户查数据、改数据。',
      art: {
        command: 'lumi-check describe Table',
        output: 'lumi-check orders.json',
        valid: '通过',
        card: '把这 3 张订单改为已发货',
        approve: '批准',
        edit: '修改',
      },
      columns: [
        { stage: '开发时', lede: 'AI 帮你写页面', items: [
          { name: 'Lumi Skill', text: '新项目自带，教 AI 查目录、写页面、自己校验' },
          { name: 'lumi-check', text: '查组件、看属性，在命令行和 CI 里校验每一份页面' },
          { name: 'create-lumi', text: '一条命令新建项目，Skill 一起生成' },
        ] },
        { stage: '使用时', lede: 'AI 陪用户干活', items: [
          { name: '助手面板', text: '每个页面旁边都能打开' },
          { name: '@ 引用', text: '把订单、客户直接带进对话' },
          { name: '/ 命令', text: '常用操作一键发起' },
          { name: '审批与对比', text: '改数据之前先给你过目' },
        ] },
      ],
    },
    arch: {
      eyebrow: '怎么搭起来的',
      title: '分层清楚，按需取用',
      lede: '建在原生 json-render 上，会 json-render 就会 Lumi。每一层只依赖下面的层：只要组件，用 Lumi UI 就够；要整套后台，再加上 Admin。',
      layers: [
        { role: '后台外壳', text: '登录、菜单、路由、多标签和工作区，还带一个 AI 助手面板' },
        { role: '组件', text: '130 多个纯 UI 组件，不碰网络请求，单独拿去用也行' },
        { role: '数据与逻辑', text: '请求、缓存、表单提交、权限和上传，hooks 和 JSON 共用一套' },
        { role: '渲染', text: '直接用上游的 Spec、Catalog、Registry 和 StateStore' },
      ],
      backend: { role: '你的后端', text: '走 JSON / HTTP，Go、PHP、Node 都能接，换后端只换一个 DataProvider' },
    },
    closing: { line: '从一段 JSON 开始。', docs: '阅读文档', demo: '看完整后台演示' },
    footer: 'Lumi，MIT 许可',
    demo: {
      locale: 'zh-CN',
      app: '示例商城',
      menu: { dashboard: '销售分析', boards: '看板与日程', tables: '表格', forms: '表单', lists: '列表' },
    },
  },
  en: {
    title: 'Lumi: the admin frontend framework built for AI',
    description: 'Lumi lets AI build admin apps in JSON: no compile step, so less time and fewer tokens; a Catalog that keeps the UI on spec; instant validation; and an agent built into the admin.',
    nav: { docs: 'Guide', components: 'Components', playground: 'Playground', demo: 'Demo', site: 'Site', language: 'Change language' },
    hero: {
      tag: 'Lumi 0.1.0 is coming, on native json-render',
      title: ['The admin framework', 'built for AI'],
      lede: 'AI writes JSON, not code. Nothing to compile, so changes show up at once. The component Catalog keeps every screen on spec, and each change is validated before it ships. Inside the admin, an agent works alongside your users.',
      start: 'Get started',
      playground: 'Open Playground',
      copy: 'Copy the install command',
      copied: 'Copied',
    },
    showcase: { label: 'Live demo', note: 'A real Lumi Admin, running in your browser. Every page is one JSON file. Click around and change some data.' },
    pillars: {
      eyebrow: 'Built for AI',
      title: 'Why it is built for AI',
      items: [
        { title: 'No compile step', text: 'AI edits one JSON file and a refresh shows it. No build, fewer tokens.' },
        { title: 'UI never drifts', text: 'Only registered components and actions. Ten edits later, still one design system.' },
        { title: 'Validated at once', text: 'Every error points to an exact field, so AI fixes it on the next try.' },
        { title: 'Built-in agent', text: 'Chat and reference data in the admin. Data changes wait for your approval.' },
      ],
    },
    flow: {
      eyebrow: 'Where AI works',
      title: 'AI from the first page to daily work',
      lede: 'While you build, AI writes pages from the Catalog and validates them itself. Once live, an agent in the same admin helps your users look things up and change data.',
      art: {
        command: 'lumi-check describe Table',
        output: 'lumi-check orders.json',
        valid: 'Valid',
        card: 'Mark these 3 orders as shipped',
        approve: 'Approve',
        edit: 'Edit',
      },
      columns: [
        { stage: 'Building', lede: 'AI writes the pages', items: [
          { name: 'Lumi Skill', text: 'Ships with every new project: look up, write, validate' },
          { name: 'lumi-check', text: 'Looks up components and props, validates every page from the CLI and in CI' },
          { name: 'create-lumi', text: 'One command for a project with the Skill set up' },
        ] },
        { stage: 'Using', lede: 'AI works with your users', items: [
          { name: 'Assistant panel', text: 'Opens beside every page' },
          { name: '@ mentions', text: 'Bring orders and customers into the chat' },
          { name: '/ commands', text: 'Start common tasks in one step' },
          { name: 'Approvals and diffs', text: 'Review every data change first' },
        ] },
      ],
    },
    arch: {
      eyebrow: 'How it fits together',
      title: 'Clear layers, take what you need',
      lede: 'Built on native json-render, so if you know json-render you know Lumi. Each layer depends only on the ones below: use Lumi UI for components alone, and add Admin for a complete back office.',
      layers: [
        { role: 'Admin shell', text: 'Sign-in, menus, routes, tabs and workspaces, plus an AI assistant panel' },
        { role: 'Components', text: '130+ pure UI components that never make requests; usable on their own' },
        { role: 'Data and logic', text: 'Requests, caching, form saves, access and uploads, shared by hooks and JSON' },
        { role: 'Rendering', text: 'Upstream Spec, Catalog, Registry and StateStore, used as they are' },
      ],
      backend: { role: 'Your backend', text: 'JSON over HTTP from Go, PHP or Node. Switching backends means switching one DataProvider' },
    },
    closing: { line: 'Start with one JSON file.', docs: 'Read the docs', demo: 'See the full demo' },
    footer: 'Lumi, MIT licensed',
    demo: {
      locale: 'en-US',
      app: 'Demo store',
      menu: { dashboard: 'Sales analytics', boards: 'Boards & calendar', tables: 'Tables', forms: 'Forms', lists: 'Lists' },
    },
  },
} as const

export type Copy = (typeof COPY)[Locale]
