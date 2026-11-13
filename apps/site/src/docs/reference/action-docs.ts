// Chinese explanations for the actions in the Admin Catalog. The Catalog stays
// the only source of action names and params; apps/site/test/action-docs.test.ts
// fails when an action or a param has no explanation here, or one is gone.

/** The element an example binds its action on; a button's press unless the action belongs elsewhere. */
export interface ActionHost {
  id: string
  type: string
  props: Record<string, unknown>
  event: string
  /** When the action runs, as the comment above it says. */
  when: string
}

export interface ActionExample {
  /** Heading of an extra example; the first one of an action has none. */
  title?: string
  /** One line under the heading saying when to write it this way. */
  intro?: string
  /** The button's label, for an example bound on a button. */
  label?: string
  host?: ActionHost
  /** The `on` binding, as it appears in a page. */
  binding: { action: string, params: Record<string, unknown> }
  /** Bindings that follow it in the same event, each with the comment saying why. */
  after?: readonly { binding: { action: string, params: Record<string, unknown> }, note: string }[]
  /** The comment above a param in this example, where the shared explanation is too general. */
  notes?: Record<string, string>
}

export interface ActionDoc {
  /** What the action does, for a page author. */
  lead: string
  /** Typical bindings, the most common first. */
  examples: readonly [ActionExample, ...ActionExample[]]
}

const form: ActionHost = { id: 'form', type: 'Form', props: {}, event: 'submit', when: '提交表单时执行' }
function prompt(event: string, when: string): ActionHost {
  return {
    id: 'prompt',
    type: 'PromptInput',
    props: { value: { $bindState: '/prompt' }, streaming: { $state: '/chat/streaming' } },
    event,
    when,
  }
}
const thread: ActionHost = {
  id: 'thread',
  type: 'ChatThread',
  props: { messages: { $state: '/chat/messages' }, activeEvent: { $bindState: '/chat/lastEvent' } },
  event: 'approve',
  when: '用户在消息里点了批准时执行；reject、answer、skip 等事件写法相同',
}

export const ACTION_DOCS: Readonly<Record<string, ActionDoc>> = {
  login: {
    lead: '登录，并在完成前清空 Lumi 的查询缓存，上一个账号的数据不会留到新会话里。',
    examples: [{ label: '登录', binding: { action: 'login', params: { params: { username: { $state: '/form/username' }, password: { $state: '/form/password' } } } }, notes: { params: '交给 AuthProvider.login 的值：这里是表单里的账号和密码' } }],
  },
  logout: {
    lead: '退出登录，并隔离已缓存的数据，下一个会话读不到。',
    examples: [{ label: '退出登录', binding: { action: 'logout', params: {} } }],
  },
  request: {
    lead: '通过 DataProvider 发一个自定义请求，可以把整理后的响应写进 `resultPath`。用于不属于增删改查的接口。',
    examples: [
      { title: '读取数据', label: '刷新统计', binding: { action: 'request', params: { url: '/orders/stats', method: 'GET', resultPath: '/stats' } }, notes: { resultPath: '响应写到 /stats，页面用 /stats/data 读' } },
      {
        title: '提交数据',
        intro: '`POST` 时请求体写在 `payload` 里。这个接口改了订单，所以在后面加一个 `invalidate` 刷新列表：把 `on` 的值写成数组，动作按顺序执行。',
        label: '重新计算',
        binding: { action: 'request', params: { url: '/orders/recalculate', method: 'POST', payload: { scope: 'unpaid' } } },
        after: [{ binding: { action: 'invalidate', params: { resource: 'orders' } }, note: '接口成功后，让 orders 的列表和详情重新请求' }],
      },
    ],
  },
  create: {
    lead: '新建一条记录，成功后刷新这个资源的所有查询。表单保存请用 `submitForm`，它会先等校验通过。',
    examples: [{ label: '保存备注', binding: { action: 'create', params: { resource: 'notes', values: { title: { $state: '/draft/title' } } } }, notes: { values: '新记录的字段：标题取自页面状态' } }],
  },
  update: {
    lead: '更新一条记录，成功后刷新这个资源的查询。`mutationMode` 为 `optimistic` 时立即显示改动、失败回滚；为 `undoable` 时还会先显示撤销提示，等 `undoableTimeout` 毫秒再提交。',
    examples: [{ label: '标记发货', binding: { action: 'update', params: { resource: 'orders', id: { $state: '/order/id' }, values: { status: 'shipped' } } }, notes: { values: '只提交要改的字段' } }],
  },
  delete: {
    lead: '删除一条记录，成功后刷新这个资源的查询。`mutationMode` 的含义和 `update` 相同。',
    examples: [{ label: '删除', binding: { action: 'delete', params: { resource: 'orders', id: { $state: '/order/id' }, mutationMode: 'undoable' } }, notes: { mutationMode: '先从列表里拿掉，几秒内可以撤销' } }],
  },
  invalidate: {
    lead: '让一个资源的查询重新请求，用于外部改了数据之后刷新列表。',
    examples: [{ label: '刷新列表', binding: { action: 'invalidate', params: { resource: 'orders' } } }],
  },
  toast: {
    lead: '显示一行轻提示（Admin 里在顶部居中），约 3 秒后关闭；`duration` 为 0 时一直显示，同一个 `key` 会原地更新。',
    examples: [{ label: '保存', binding: { action: 'toast', params: { tone: 'success', message: '已保存' } } }],
  },
  notify: {
    lead: '显示一张通知卡片（Admin 里在右上角），有标题、说明和最多 3 个按钮，按钮执行 Catalog 里的动作后关闭；默认约 4.5 秒后关闭，`duration` 为 0 时一直显示。',
    examples: [
      { title: '只有文字的通知', label: '导出', binding: { action: 'notify', params: { tone: 'info', title: '导出完成', description: '共 1,284 条订单' } } },
      {
        title: '带按钮的通知',
        intro: '按钮写在 `actions` 里，每个按钮执行一个动作。`duration` 为 0 时通知一直留着，直到用户点按钮或关闭。',
        label: '发布',
        binding: { action: 'notify', params: { key: 'published', tone: 'success', title: '订单已发布', duration: 0, actions: [{ label: '查看', action: 'navigate', params: { to: '/orders' } }] } },
        notes: { key: '之后可以用 closeNotice 按这个 key 关闭', actions: '点“查看”跳到订单列表，通知随之关闭' },
      },
    ],
  },
  closeNotice: {
    lead: '关闭 `notify` 打开的、`key` 对应的通知卡片。',
    examples: [{ label: '知道了', binding: { action: 'closeNotice', params: { key: 'published' } } }],
  },
  exportList: {
    lead: '把符合筛选条件的全部记录导出为 CSV（UTF-8，Excel 可直接打开）或 JSON。通过 getList 逐页读取，最多 `maxItems` 条（默认 10000）。给了 `url` 时改由后端生成文件：把筛选、排序、列和格式发给这个接口，边接收边保存返回的文件流，格式不限。',
    examples: [
      {
        title: '在浏览器里导出',
        intro: '不写 `url`：逐页读取列表，在浏览器里生成 CSV 或 JSON。适合几千条以内的数据。',
        label: '导出 CSV',
        binding: { action: 'exportList', params: { resource: 'orders', filters: { $state: '/filters' }, format: 'csv', filename: 'orders' } },
        notes: { filters: '只导出当前筛选出来的记录', format: 'csv 或 json' },
      },
      {
        title: '由后端导出',
        intro: '写上 `url`：筛选、排序、列和格式发给这个接口，后端生成文件并以文件流返回，格式不限（如 Excel）。数据量大时用它。后端要怎么接，见 [后端导出](/guide/backend-files/#后端导出)。',
        label: '导出 Excel',
        binding: { action: 'exportList', params: { resource: 'orders', url: '/orders/export', format: 'xlsx', filters: { $state: '/filters' }, progressPath: '/export/progress' } },
        notes: { url: '后端的导出接口，相对于后端地址', format: '后端支持的任何格式', filters: '当前的筛选条件，一起发给后端', progressPath: '进度写到这里：loaded 是已接收的字节数' },
      },
    ],
  },
  importList: {
    lead: '让用户选一个 CSV 或 JSON 文件，逐条通过 create（或按 `batchSize` 通过 createMany）新建记录，被拒绝的行跳过继续。进度写进 `progressPath`，结果写进 `resultPath` 并弹出通知，最后刷新资源。给了 `url` 时改由后端导入：把文件原样上传到这个接口，返回的就是导入结果。',
    examples: [
      {
        title: '在浏览器里导入',
        intro: '不写 `url`：在浏览器里读 CSV 或 JSON，每一行调用一次新建接口。',
        label: '导入 CSV',
        binding: { action: 'importList', params: { resource: 'customers', progressPath: '/import/progress', resultPath: '/import/result' } },
        notes: { progressPath: '进度写到这里：已处理、成功、失败的条数', resultPath: '结束后的结果写到这里，含每个被拒绝的行' },
      },
      {
        title: '由后端导入',
        intro: '写上 `url`：用户选的文件原样上传到这个接口（表单字段 `file`），由后端解析、校验、落库，返回导入结果。文件格式由后端决定。后端要怎么接，见 [后端导入](/guide/backend-files/#后端导入)。',
        label: '导入 Excel',
        binding: { action: 'importList', params: { resource: 'products', url: '/products/import', accept: '.xlsx,.csv', progressPath: '/import/progress', resultPath: '/import/result' } },
        notes: { url: '后端的导入接口，相对于后端地址', accept: '文件选择框里允许的类型', progressPath: '进度写到这里：uploaded 是文件已上传的百分比', resultPath: '后端返回的导入结果写到这里' },
      },
    ],
  },
  submitForm: {
    lead: '保存表单：先校验页面状态里的表单值，等业务校验通过，只提交一次，保存成功后才应用 `successState`。没有 `id` 新建，有 `id` 更新。字段错误会写回对应字段。',
    examples: [{ host: form, binding: { action: 'submitForm', params: { resource: 'orders', id: { $state: '/order/id' }, valuesPath: '/form', validationPath: '/formStatus', successState: { '/drawer/open': false } } }, notes: { id: '有值时更新这条记录，为空时新建', validationPath: '提交中、字段错误写到这里', successState: '保存成功才关闭抽屉' } }],
  },
  agentSend: {
    lead: '在 `session` 指向的 AgentSession 里发送一条消息。回复进行中或没有内容时忽略；消息被接受后才清空 `clear` 列出的路径。',
    examples: [{ host: prompt('submit', '在输入框里按下发送时执行'), binding: { action: 'agentSend', params: { session: '/chat', text: { $state: '/prompt' }, clear: ['/prompt'] } }, notes: { text: '输入框里的文字', clear: '消息发出后清空输入框' } }],
  },
  agentStop: {
    lead: '停止正在进行的回复，已经收到的内容保留。',
    examples: [{ host: prompt('stop', '回复过程中点了停止时执行'), binding: { action: 'agentStop', params: { session: '/chat' } } }],
  },
  agentRetry: {
    lead: '让 Agent 重新回答最后一条用户消息。',
    examples: [{ label: '重新回答', binding: { action: 'agentRetry', params: { session: '/chat' } } }],
  },
  agentEvent: {
    lead: '把 ChatThread 的事件交给会话处理：approve、reject 决定审批，answer、skip 回答问题（没有待回答的就继续回复），regenerate 重试，edit 改写用户消息，suggestion 直接发送建议。',
    examples: [{ host: thread, binding: { action: 'agentEvent', params: { session: '/chat', event: { $state: '/chat/lastEvent' } } }, notes: { event: 'ChatThread 把这次操作写在 activeEvent 绑定的路径里' } }],
  },
  navigate: {
    lead: '跳转到一个明确的 Admin 地址。',
    examples: [{ label: '查看订单', binding: { action: 'navigate', params: { to: '/orders' } } }],
  },
  openDrawer: {
    lead: '打开一个抽屉或弹窗。内容可以是任意页面 JSON（`src`），也可以是代码里注册的抽屉（`name`）。页面 JSON 只按地址加载一次，`id` 和 `params` 写进它的页面状态 `/drawer`。抽屉有自己的地址，可以刷新和分享；在抽屉里再打开会叠在上面，最多三层。',
    examples: [
      {
        title: '打开一个页面 JSON',
        intro: '弹窗的内容是一个普通的页面 JSON，任何页面都能按地址打开它，见 [共用弹窗](/guide/reuse/#共用弹窗)。',
        label: '编辑',
        binding: { action: 'openDrawer', params: { src: '/pages/article-edit.json', id: { $state: '/table/row/id' }, title: '编辑文章' } },
        notes: { id: '这条记录，弹窗页面里用 /drawer/id 读取' },
      },
      {
        title: '打开代码里注册的抽屉',
        intro: '用 `name` 打开 `createAdmin` 或扩展模块的 `drawers` 里注册的 React 抽屉，见 [路由抽屉](/guide/advanced/admin/#路由抽屉)。',
        label: '编辑客户',
        binding: { action: 'openDrawer', params: { name: 'edit-customer', id: { $state: '/table/row/id' } } },
        notes: { id: '抽屉里用 useAdminDrawer().recordId 读取' },
      },
    ],
  },
  closeDrawer: {
    lead: '关闭当前这一层抽屉（以及它上面的层），有未保存的改动时先经过离开确认。',
    examples: [{ label: '取消', binding: { action: 'closeDrawer', params: {} } }],
  },
}

/** Params that mean the same thing on every action that has them. */
export const ACTION_PARAMS: Readonly<Record<string, string>> = {
  params: '登录或退出时交给 AuthProvider 的参数。',
  url: '请求地址，相对于 DataProvider 的 API 地址。',
  method: 'HTTP 方法：`GET`（默认）、`POST`、`PUT`、`PATCH` 或 `DELETE`。',
  query: '查询参数。',
  payload: '请求体；`GET` 不能带。',
  resource: '数据资源名，如 `orders`。',
  dataProviderName: '使用哪个数据源；省略时用当前范围的数据源，没有就是 default。',
  meta: '原样传给 DataProvider 的扩展数据。',
  id: '记录主键。',
  values: '要提交的字段。',
  resultPath: '把结果写进页面状态的路径，如 `/result`。',
  mutationMode: '`pessimistic` 等服务器返回，`optimistic` 立即显示，`undoable` 可撤销。',
  undoableTimeout: '`undoable` 模式下等待撤销的毫秒数，默认 5000。',
  key: '提示的标识。',
  tone: '语义色：`success`、`warning`、`danger`、`info`、`neutral`。',
  message: '提示文字。',
  duration: '显示毫秒数；0 表示一直显示。',
  title: '标题。',
  description: '说明文字。',
  actions: '通知上的按钮，最多 3 个，每个 `{ label, action, params? }`；点击后执行这个动作并关闭通知。',
  filters: '筛选条件，通常绑定到列表的筛选状态。',
  sorters: '排序条件。',
  columns: '导出或导入的列，每个 `{ field, label }`。',
  format: '文件格式：`csv`（默认）或 `json`；给了 `url` 时可以是后端支持的任何格式，如 `xlsx`。',
  filename: '下载的文件名，不含扩展名；默认是资源名。',
  pageSize: '每次读取的条数，最多 1000。',
  maxItems: '最多导出的条数，默认 10000。',
  progressPath: '把进度写进页面状态的路径。',
  accept: '文件选择框里允许的类型；默认 CSV 和 JSON，给了 `url` 时默认不限。',
  batchSize: '按批调用 createMany 时每批的条数；不填则逐条 create。默认的 DataProvider 没有批量新建，始终逐条。',
  valuesPath: '表单值在页面状态里的路径，如 `/form`。',
  validationPath: '保存状态写进页面状态的路径：`{ pending, valid, errors, fieldErrors }`。省略时写在内部路径里。',
  rules: '业务校验规则，交给注册的 Validator；没有注册 Validator 时不要写。',
  successState: '保存成功后写入的状态，键是状态路径，如 `{ "/drawer/open": false }`。',
  session: 'AgentSession 写入的状态路径，如 `/chat`。',
  text: '要发送的文字。',
  context: '随消息发送的引用，如 `@` 选中的订单。',
  attachments: '随消息发送的附件。',
  clear: '消息被接受后清空的状态路径。',
  event: 'ChatThread 发出的事件。',
  to: '目标地址，如 `/orders/12`。',
  replace: '替换当前历史记录，而不是新增一条。',
  name: '抽屉在 Admin 里注册的名称。',
  src: '页面 JSON 的地址，如 `/pages/article-edit.json`。只能是本站路径或相对于 manifest 的路径。',
  mode: '`drawer`（默认）从侧边滑出，`modal` 居中弹出。',
  size: '`sm`、`md` 或 `lg`。',
}

/** Params whose meaning on one action differs from the shared one above. */
export const ACTION_PARAM_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  request: {
    resultPath: '把响应写进页面状态的路径，如 `/stats`；内容是 `{ data }`，用 `/stats/data` 读。',
  },
  create: {
    id: '不使用：新记录的主键由后端分配。',
    values: '新记录的字段。',
    resultPath: '把保存结果 `{ data }` 写进页面状态的路径。',
  },
  update: {
    id: '要更新的记录主键，必须有值。',
    values: '要修改的字段。',
    resultPath: '把保存结果 `{ data }` 写进页面状态的路径。',
  },
  delete: {
    id: '要删除的记录主键，必须有值。',
    values: '不使用：删除不提交字段。',
    resultPath: '把删除结果 `{ data }` 写进页面状态的路径。',
  },
  invalidate: {
    meta: '不使用。',
  },
  toast: {
    key: '同一个 `key` 的提示会原地更新，不会再叠一条。',
  },
  notify: {
    key: '通知的标识：同一个 `key` 原地更新，`closeNotice` 用它关闭。',
  },
  closeNotice: {
    key: '要关闭的通知的 `key`。',
  },
  exportList: {
    url: '后端的导出接口，相对于 DataProvider 的 API 地址。写了它，文件由后端生成并以文件流返回；不写时在浏览器里逐页读取并生成。',
    method: '请求导出接口的方法：`POST`（默认）把筛选、排序、列和格式放在请求体里，`GET` 放在查询串里。只在写了 `url` 时有用。',
    meta: '不写 `url` 时原样传给 DataProvider；写了 `url` 时和筛选条件一起发给导出接口。',
    progressPath: '把进度写进页面状态的路径，内容是 `{ loading, loaded, total }`。写了 `url` 时 `loaded` 是已接收的字节数。',
  },
  importList: {
    url: '后端的导入接口，相对于 DataProvider 的 API 地址。写了它，文件原样上传（表单字段 `file`）由后端导入；不写时在浏览器里解析并逐条新建。',
    meta: '不写 `url` 时原样传给 DataProvider；写了 `url` 时作为其他表单字段和文件一起上传。',
    columns: '导入的列，每个 `{ field, label }`，把文件里的表头对应到字段。写了 `url` 时不使用。',
    progressPath: '把进度写进页面状态的路径。写了 `url` 时其中的 `uploaded` 是文件已上传的百分比。',
    resultPath: '把导入结果写进页面状态的路径：`{ total, succeeded, failed, errors }`。',
  },
  submitForm: {
    id: '有值时更新这条记录，没有时新建。',
    values: '不使用：提交的是 `valuesPath` 里的值。',
    resultPath: '把保存结果 `{ data }` 写进页面状态的路径。',
  },
  openDrawer: {
    name: '代码里注册的抽屉名称。和 `src` 二选一。',
    id: '记录主键，页面里用 `/drawer/id` 读取。',
    params: '传给页面的其他值，页面里用 `/drawer/params` 读取。会写进地址栏，只放少量数据。',
    title: '抽屉或弹窗的标题。',
  },
}
